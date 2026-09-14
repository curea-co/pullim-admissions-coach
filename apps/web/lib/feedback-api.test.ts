import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import {
  appVersion,
  postFeedbackToApi,
  resolveFeedbackApiTarget,
  resolveUserId,
  type FeedbackApiPayload,
  type FeedbackApiTarget,
} from './feedback-api';
import type { PinnedRequestFn } from './pinned-request';

// 저장 표면 계약 고정. 여기서 지키는 것 세 가지:
//  ① 구성이 없거나 안전하지 않으면 **대상을 만들지 않는다**(라우트가 501 로 끝낸다).
//  ② 보내는 것은 계약에 선언된 필드뿐 — 신원은 userId 하나이고 프로필은 담기지 않는다.
//  ③ 신원은 **쿠키로만** 확인한다. 확인되지 않으면 null 이고, 그 실패가 건의를 막지 않는다.

const target: FeedbackApiTarget = {
  endpoint: new URL('https://api.example.test/feedback'),
  identityEndpoint: new URL('https://api.example.test/me'),
  address: '93.184.216.34',
  serviceKey: 'svc-key-123',
};

const payload: FeedbackApiPayload = {
  service: 'admissions',
  category: 'bug',
  content: '탭을 바꾸면 스크롤이 맨 위로 올라가요.',
  userId: null,
  context: { pageUrl: '/result?tab=interview', userAgent: 'UA/1.0', viewport: { w: 390, h: 844 } },
};

// 이름이 **실제로 해석되는 주소**까지 확인하므로(SSRF 방어) DNS 는 테스트에서 실제로 나가면
// 안 되고, 해석 결과별 동작도 골라 봐야 한다.
const dnsLookup = vi.hoisted(() => vi.fn());
vi.mock('node:dns/promises', () => ({ lookup: dnsLookup }));

beforeEach(() => {
  dnsLookup.mockReset();
  dnsLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]); // 공인 주소
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('resolveFeedbackApiTarget — 구성', () => {
  beforeEach(() => {
    vi.stubEnv('PULLIM_API_URL', 'https://api.example.test');
    vi.stubEnv('FEEDBACK_SERVICE_KEY', 'svc-key-123');
  });

  it('두 값이 있으면 /feedback·/me 주소를 만든다', async () => {
    const r = await resolveFeedbackApiTarget();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.target.endpoint.href).toBe('https://api.example.test/feedback');
    expect(r.target.identityEndpoint.href).toBe('https://api.example.test/me');
    expect(r.target.serviceKey).toBe('svc-key-123');
  });

  it('베이스의 경로를 버리지 않는다(https://host/api → /api/feedback)', async () => {
    vi.stubEnv('PULLIM_API_URL', 'https://api.example.test/api/');
    const r = await resolveFeedbackApiTarget();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.target.endpoint.href).toBe('https://api.example.test/api/feedback');
    expect(r.target.identityEndpoint.href).toBe('https://api.example.test/api/me');
  });

  // 경로를 상대 참조 문자열로 이어 붙이면 `//` 로 시작하는 경로가 **스킴 상대 URL** 로
  // 해석돼 호스트가 통째로 바뀐다 — 그 주소로 서비스 키와 인증 쿠키가 나간다.
  it.each([
    ['스킴 상대 경로', 'https://api.example.test//evil.example/x'],
    ['역슬래시 표기', 'https://api.example.test/\\\\evil.example/x'],
    ['상위 경로 탈출 시도', 'https://api.example.test/api/../../x'],
  ])('조합 결과는 설정된 호스트를 벗어나지 않는다(%s)', async (_label, url) => {
    vi.stubEnv('PULLIM_API_URL', url);
    const r = await resolveFeedbackApiTarget();
    if (!r.ok) return; // 구성 오류로 끊는 것도 안전한 결말이다
    expect(r.target.endpoint.origin).toBe('https://api.example.test');
    expect(r.target.identityEndpoint.origin).toBe('https://api.example.test');
    expect(r.target.endpoint.hostname).toBe('api.example.test');
    expect(r.target.identityEndpoint.hostname).toBe('api.example.test');
  });

  it.each([
    ['PULLIM_API_URL', 'PULLIM_API_URL'],
    ['FEEDBACK_SERVICE_KEY', 'FEEDBACK_SERVICE_KEY'],
  ])('%s 가 비면 미구성 — 어느 값이 없는지 이름으로 말한다', async (_label, name) => {
    vi.stubEnv(name, '');
    const r = await resolveFeedbackApiTarget();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('not-configured');
    if (r.reason !== 'not-configured') return;
    expect(r.missing).toEqual([name]);
  });

  it('둘 다 비면 둘 다 이름을 댄다', async () => {
    vi.stubEnv('PULLIM_API_URL', '   ');
    vi.stubEnv('FEEDBACK_SERVICE_KEY', '');
    const r = await resolveFeedbackApiTarget();
    expect(r.ok).toBe(false);
    if (r.ok || r.reason !== 'not-configured') return;
    expect(r.missing).toEqual(['PULLIM_API_URL', 'FEEDBACK_SERVICE_KEY']);
  });

  it.each([
    ['스킴 누락', 'api.example.test'],
    ['빈 경로만', '///'],
    ['file 스킴', 'file:///etc/passwd'],
    ['javascript 스킴', 'javascript:alert(1)'],
    // 문자열로 이어 붙이면 `/api?v=1/feedback` 이 되어 엉뚱한 주소로 간다 — 구성 오류로 끊는다.
    ['쿼리가 붙은 베이스', 'https://api.example.test/api?version=1'],
    ['프래그먼트가 붙은 베이스', 'https://api.example.test/api#frag'],
    // URL 안의 자격증명은 요청과 함께 나간다.
    ['인증정보가 박힌 베이스', 'https://user:pass@api.example.test'],
  ])('이어 붙일 수 없는 주소(%s)는 대상이 되지 않는다', async (_label, url) => {
    vi.stubEnv('PULLIM_API_URL', url);
    const r = await resolveFeedbackApiTarget();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('invalid-url');
  });

  // http 는 **주소로** 가른다 — NODE_ENV 로 가르면 개발·프리뷰에서 원격 http 가 열려 그
  // 환경의 서비스 키가 평문으로 흘러간다.
  it.each([
    ['localhost', 'http://localhost:3000'],
    ['127.0.0.1', 'http://127.0.0.1:3000'],
    ['127.x 대역', 'http://127.1.2.3:3000'],
    ['IPv6 loopback', 'http://[::1]:3000'],
    ['*.localhost', 'http://api.localhost:3000'],
  ])('loopback(%s)은 http 를 허용한다 — 네트워크로 나가지 않는다', async (_label, url) => {
    vi.stubEnv('PULLIM_API_URL', url);
    expect((await resolveFeedbackApiTarget()).ok).toBe(true);
  });

  it.each([
    ['개발/프리뷰의 원격 호스트', 'test', 'http://api.example.test'],
    ['프로덕션의 원격 호스트', 'production', 'http://api.example.test'],
    ['loopback 을 닮은 이름', 'test', 'http://localhost.evil.example.com'],
    ['사설 IP', 'test', 'http://10.1.2.3:3000'],
  ])('loopback 이 아닌 평문 http(%s)는 거절 — 서비스 키가 그대로 흘러간다', async (_l, env, url) => {
    vi.stubEnv('NODE_ENV', env);
    vi.stubEnv('PULLIM_API_URL', url);
    const r = await resolveFeedbackApiTarget();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('insecure');
  });

  it('프로덕션에서도 https 는 그대로 통과(allowlist 와 함께)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('FEEDBACK_API_ALLOWED_HOSTS', 'api.example.test');
    vi.stubEnv('PULLIM_API_URL', 'https://api.example.test');
    expect((await resolveFeedbackApiTarget()).ok).toBe(true);
  });
});

// 이 경로는 `x-service-key` 와 인증 쿠키를 실어 보낸다 — 주소가 내부망을 가리키면 그 자체가
// secret 유출이다. 웹훅 시절과 같은 검사를 그대로 건다(lib/webhook-target.ts 재사용).
describe('resolveFeedbackApiTarget — 자격증명을 보낼 주소인가(SSRF 방어)', () => {
  beforeEach(() => vi.stubEnv('FEEDBACK_SERVICE_KEY', 'svc-key-123'));

  it.each([
    ['사설 IP', 'https://10.1.2.3'],
    ['링크로컬(메타데이터)', 'https://169.254.169.254'],
    ['IPv6 ULA', 'https://[fd00::1]'],
    ['내부 도메인', 'https://pullim-api.internal'],
    ['.local', 'https://api.pullim.local'],
  ])('내부망을 가리키는 이름(%s)은 거절', async (_label, url) => {
    vi.stubEnv('PULLIM_API_URL', url);
    const r = await resolveFeedbackApiTarget();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('not-allowed');
  });

  it('공인 도메인이 내부 주소로 해석되면 거절(127.0.0.1.nip.io 류)', async () => {
    vi.stubEnv('PULLIM_API_URL', 'https://127.0.0.1.nip.io');
    dnsLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
    const r = await resolveFeedbackApiTarget();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('not-allowed');
  });

  it('DNS 해석이 실패하면 거절 — 모르면 보내지 않는다', async () => {
    vi.stubEnv('PULLIM_API_URL', 'https://api.example.test');
    dnsLookup.mockRejectedValue(new Error('ENOTFOUND'));
    const r = await resolveFeedbackApiTarget();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('not-allowed');
  });

  it('프로덕션에서 allowlist 미설정이면 보내지 않는다 — 리바인딩 틈을 닫는 최소 조건', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PULLIM_API_URL', 'https://api.example.test');
    const r = await resolveFeedbackApiTarget();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('allowlist-required');
  });

  it('allowlist 밖의 호스트는 거절(하위 도메인은 인정)', async () => {
    vi.stubEnv('FEEDBACK_API_ALLOWED_HOSTS', 'pullim.ai');
    vi.stubEnv('PULLIM_API_URL', 'https://api.evil.example');
    const blocked = await resolveFeedbackApiTarget();
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toBe('not-allowed');

    vi.stubEnv('PULLIM_API_URL', 'https://api.pullim.ai');
    expect((await resolveFeedbackApiTarget()).ok).toBe(true);
  });

  it('loopback 은 allowlist·DNS 확인을 거치지 않는다(같은 기계 안에서 끝난다)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PULLIM_API_URL', 'http://127.0.0.1:3000');
    expect((await resolveFeedbackApiTarget()).ok).toBe(true);
    expect(dnsLookup).not.toHaveBeenCalled();
  });
});

describe('appVersion — 모르면 비운다', () => {
  it('APP_VERSION 을 먼저 본다', () => {
    vi.stubEnv('APP_VERSION', '2026.09.04-1');
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc123');
    expect(appVersion()).toBe('2026.09.04-1');
  });

  it('Vercel 커밋 SHA 로 폴백', () => {
    vi.stubEnv('APP_VERSION', '');
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc123');
    expect(appVersion()).toBe('abc123');
  });

  it('둘 다 없으면 undefined — 가짜 버전을 만들지 않는다', () => {
    vi.stubEnv('APP_VERSION', '');
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', '');
    expect(appVersion()).toBeUndefined();
  });
});

// 전송은 **검증한 IP 에 고정한 요청**이다(lib/pinned-request.ts) — fetch 가 아니다.
// 여기서는 node http(s) 의 request 를 대신 넣어 무엇이 어느 주소로 나가는지 잡는다.
interface Sent {
  url?: unknown;
  options?: Record<string, unknown>;
  body?: string;
  /** lookup 콜백이 실제로 돌려준 주소 — "연결이 그 IP 로 간다"의 증거. */
  pinned?: string;
  resDestroyed?: boolean;
}

/** 상태·본문을 정해 놓고 응답하는 가짜 request. */
function fakeRequest(sent: Sent, status: number, responseBody = ''): PinnedRequestFn {
  return ((url: unknown, options: Record<string, unknown>, cb: (res: unknown) => void) => {
    sent.url = url;
    sent.options = options;
    // 고정이 실제로 걸렸는지 확인하려면 콜백까지 불러 봐야 한다.
    const lookup = options.lookup as (h: string, o: object, c: (e: null, a: string) => void) => void;
    lookup('ignored.example', {}, (_e, address) => {
      sent.pinned = address;
    });

    const req = new EventEmitter() as EventEmitter & {
      end: (body?: string) => void;
      destroy: (e?: Error) => void;
    };
    req.destroy = () => {};
    req.end = (body?: string) => {
      sent.body = body;
      // node 는 인코딩 지정이 없으면 Buffer 를 흘린다 — 실제와 같게 맞춘다.
      const res = Readable.from([Buffer.from(responseBody)]) as Readable & { statusCode: number };
      res.statusCode = status;
      const origDestroy = res.destroy.bind(res);
      res.destroy = ((error?: Error) => {
        sent.resDestroyed = true;
        origDestroy(error);
        return res;
      }) as typeof res.destroy;
      setImmediate(() => cb(res));
    };
    return req;
  }) as unknown as PinnedRequestFn;
}

describe('postFeedbackToApi — 전송 형태', () => {
  it('x-service-key 를 붙여 JSON 으로 POST 하고, 연결은 검증한 IP 에 고정한다', async () => {
    const sent: Sent = {};
    const status = await postFeedbackToApi(target, payload, {
      timeoutMs: 5_000,
      request: fakeRequest(sent, 201),
    });

    expect(status).toBe(201);
    expect(String(sent.url)).toBe('https://api.example.test/feedback');
    expect(sent.options?.method).toBe('POST');
    const headers = sent.options?.headers as Record<string, string>;
    expect(headers['x-service-key']).toBe('svc-key-123');
    expect(headers['content-type']).toBe('application/json');
    expect(JSON.parse(String(sent.body))).toEqual(payload);
    // **확인한 그 IP 로** 연결한다 — 이름으로 다시 해석하면 리바인딩이 열린다.
    expect(sent.pinned).toBe('93.184.216.34');
  });

  it('쓰지 않을 응답 본문은 읽지 않고 파기한다(소켓을 붙잡아 두지 않게)', async () => {
    const sent: Sent = {};
    await postFeedbackToApi(target, payload, {
      timeoutMs: 5_000,
      request: fakeRequest(sent, 201, JSON.stringify({ id: 'f_1', createdAt: 'x' })),
    });
    expect(sent.resDestroyed).toBe(true);
  });

  it('상태 코드를 그대로 돌려준다 — 성공 판단은 호출부 몫(3xx 는 성공이 아니다)', async () => {
    const sent: Sent = {};
    expect(
      await postFeedbackToApi(target, payload, { timeoutMs: 5_000, request: fakeRequest(sent, 302) }),
    ).toBe(302);
  });

  it('연결 실패는 그대로 던진다(호출부가 502 로 바꾼다)', async () => {
    const boom = (() => {
      throw new Error('ECONNREFUSED');
    }) as unknown as PinnedRequestFn;
    await expect(
      postFeedbackToApi(target, payload, { timeoutMs: 5_000, request: boom }),
    ).rejects.toThrow();
  });

  it('본문에 프로필(이름·이메일·등급)이 섞일 자리가 없다', async () => {
    const sent: Sent = {};
    await postFeedbackToApi(
      target,
      // 타입 밖의 값을 억지로 끼워도 **직렬화는 payload 그대로** 이므로, 이 테스트는 계약이
      // 넓어지는 순간(예: 라우트가 user 객체를 통째로 넘기는 변경) 함께 깨져야 한다.
      { ...payload, userId: 'u_1' },
      { timeoutMs: 5_000, request: fakeRequest(sent, 201) },
    );
    const body = JSON.parse(String(sent.body)) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['category', 'content', 'context', 'service', 'userId']);
    expect(JSON.stringify(body)).not.toMatch(/displayName|email|tier|isMinor/);
  });
});

describe('resolveUserId — 신원은 쿠키로만', () => {
  beforeEach(() => vi.stubEnv('FEEDBACK_IDENTITY_COOKIES', 'pullim_at,pullim_rt'));

  const ok = (sent: Sent, body: unknown) => fakeRequest(sent, 200, JSON.stringify(body));

  it('쿠키가 없으면 왕복 자체를 만들지 않는다', async () => {
    const never = vi.fn() as unknown as PinnedRequestFn;
    expect(await resolveUserId(null, target, { timeoutMs: 2_000, request: never })).toBeNull();
    expect(never).not.toHaveBeenCalled();
  });

  it('인증된 요청이면 /me 의 sub 를 쓴다 — 연결은 저장과 같은 IP 에 고정한다', async () => {
    const sent: Sent = {};
    const userId = await resolveUserId('pullim_at=xyz', target, {
      timeoutMs: 2_000,
      request: ok(sent, { sub: 'u_abc', email: 'a@b.c' }),
    });

    expect(userId).toBe('u_abc');
    expect(String(sent.url)).toBe('https://api.example.test/me');
    expect(sent.options?.method).toBe('GET');
    expect((sent.options?.headers as Record<string, string>).cookie).toBe('pullim_at=xyz');
    // 쿠키가 나가는 요청이다 — 여기서 리바인딩이 열리면 인증 쿠키가 내부 주소로 간다.
    expect(sent.pinned).toBe('93.184.216.34');
  });

  // 받은 Cookie 헤더를 통째로 넘기면 브라우저의 쿠키 격리를 서버가 우회하게 된다.
  // 넘어가는 것은 **운영자가 선언한 이름만**이다.
  it('선언하지 않은 쿠키(웹 전용 세션·CSRF·__Host-*)는 api 로 넘어가지 않는다', async () => {
    const sent: Sent = {};
    await resolveUserId(
      '__Host-web_csrf=c1; web_session=s1; pullim_at=xyz; _ga=GA1.2.3; pullim_rt=rrr',
      target,
      { timeoutMs: 2_000, request: ok(sent, { sub: 'u_abc' }) },
    );

    const cookie = (sent.options?.headers as Record<string, string>).cookie;
    expect(cookie).toBe('pullim_at=xyz; pullim_rt=rrr');
    expect(cookie).not.toMatch(/__Host-|web_session|_ga/);
  });

  it('FEEDBACK_IDENTITY_COOKIES 미선언이면 아무것도 넘기지 않고 호출도 하지 않는다(fail-closed)', async () => {
    vi.stubEnv('FEEDBACK_IDENTITY_COOKIES', '');
    const never = vi.fn() as unknown as PinnedRequestFn;
    expect(
      await resolveUserId('pullim_at=xyz', target, { timeoutMs: 2_000, request: never }),
    ).toBeNull();
    expect(never).not.toHaveBeenCalled();
  });

  it('선언된 쿠키가 요청에 없으면 호출하지 않는다', async () => {
    const never = vi.fn() as unknown as PinnedRequestFn;
    expect(
      await resolveUserId('web_session=s1; _ga=GA1.2.3', target, { timeoutMs: 2_000, request: never }),
    ).toBeNull();
    expect(never).not.toHaveBeenCalled();
  });

  it('이름이 부분 일치하는 쿠키(pullim_at_shadow)는 넘기지 않는다', async () => {
    const never = vi.fn() as unknown as PinnedRequestFn;
    expect(
      await resolveUserId('pullim_at_shadow=evil', target, { timeoutMs: 2_000, request: never }),
    ).toBeNull();
    expect(never).not.toHaveBeenCalled();
  });

  it.each([
    ['미인증(401)', 401],
    ['권한 없음(403)', 403],
    ['서버 오류(500)', 500],
    ['리다이렉트(302)', 302],
  ])('%s 는 "모른다" 로 본다 — null', async (_label, status) => {
    // 본문에 sub 가 **들어 있어도** 200 이 아니면 쓰지 않는다. api 가 오류 본문에 식별자를
    // 실어 보내는 경우(또는 로그인 페이지 HTML/JSON)에 남의 id 를 주워 담지 않게 하는 경계다.
    const sent: Sent = {};
    const request = fakeRequest(sent, status, JSON.stringify({ sub: 'u_not_authenticated' }));
    expect(await resolveUserId('pullim_at=xyz', target, { timeoutMs: 2_000, request })).toBeNull();
  });

  it.each([
    ['sub 없음', { email: 'a@b.c' }],
    ['sub 가 문자열이 아님', { sub: 12345 }],
    ['sub 가 공백', { sub: '   ' }],
  ])('%s → null(추측하지 않는다)', async (_label, body) => {
    const sent: Sent = {};
    expect(
      await resolveUserId('pullim_at=xyz', target, { timeoutMs: 2_000, request: ok(sent, body) }),
    ).toBeNull();
  });

  it('연결 실패·JSON 깨짐은 삼킨다 — 신원 확인 실패가 건의를 잃게 하지 않는다', async () => {
    const boom = (() => {
      throw new Error('ETIMEDOUT');
    }) as unknown as PinnedRequestFn;
    expect(await resolveUserId('pullim_at=xyz', target, { timeoutMs: 2_000, request: boom })).toBeNull();

    const sent: Sent = {};
    const broken = fakeRequest(sent, 200, 'not json');
    expect(
      await resolveUserId('pullim_at=xyz', target, { timeoutMs: 2_000, request: broken }),
    ).toBeNull();
  });

  it('sub 가 길어도 저장값이 무한정 커지지 않게 자른다', async () => {
    const sent: Sent = {};
    const userId = await resolveUserId('pullim_at=xyz', target, {
      timeoutMs: 2_000,
      request: ok(sent, { sub: 'u'.repeat(500) }),
    });
    expect(userId).toHaveLength(128);
  });

  it('응답 본문이 상한을 넘으면 신원을 쓰지 않는다(응답이 메모리를 먹지 않게)', async () => {
    const sent: Sent = {};
    const huge = fakeRequest(sent, 200, 'x'.repeat(17 * 1024));
    expect(await resolveUserId('pullim_at=xyz', target, { timeoutMs: 2_000, request: huge })).toBeNull();
  });
});
