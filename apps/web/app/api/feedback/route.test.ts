import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';

// 수신 라우트 계약 고정. 핵심은 **정직성**이다 — 전달되지 않았으면 성공을 돌려주지 않는다.
// (수집처 미설정 501 / 수집처 실패 502). 그 다음이 남용 방어(레이트리밋·본문 크기)와 입력 방어.

const WEBHOOK = 'https://hooks.example.test/services/T000/B000/xxx';

/** 라우트가 받는 것은 표준 Request 다. 헤더를 직접 넣어야 하는 케이스(content-length)도 있어 옵션으로 연다. */
function post(body: string | object, headers: Record<string, string> = {}) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return new Request('http://localhost:3007/api/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: raw,
  });
}

// 수집처로의 실제 전송(고정 IP POST)은 mock 한다 — 여기서 확인할 것은 라우트의 판단이다.
// 연결이 검증한 IP 로 가는지는 lib/webhook-post.test.ts 가 본다.
const sendMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/webhook-post', () => ({ postJsonPinned: sendMock }));

// 수집처 이름의 DNS 해석은 테스트에서 실제로 나가면 안 되고, 해석 결과별 동작을 골라 봐야 한다.
const dnsLookup = vi.hoisted(() => vi.fn());
vi.mock('node:dns/promises', () => ({ lookup: dnsLookup }));

// 라우트는 프로세스 수명 동안 유지되는 레이트리밋 싱글톤을 쓴다. 테스트마다 모듈을 새로
// 불러 카운터를 0 에서 시작하게 한다 — 안 그러면 앞 테스트의 호출이 뒤 테스트를 429 로 만든다.
let POST: (req: Request) => Promise<Response>;

beforeEach(async () => {
  sendMock.mockReset();
  sendMock.mockResolvedValue(200);
  dnsLookup.mockReset();
  dnsLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]); // 공인 주소
  vi.resetModules();
  ({ POST } = await import('./route'));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('POST /api/feedback — 수집처 구성', () => {
  it('FEEDBACK_WEBHOOK_URL 미설정 → 501 + 명확한 코드(조용한 성공 금지)', async () => {
    vi.stubEnv('FEEDBACK_WEBHOOK_URL', '');
    const res = await POST(post({ category: 'general', content: '내용' }));
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe('FEEDBACK_SINK_NOT_CONFIGURED');
    expect(body.message).toContain('FEEDBACK_WEBHOOK_URL');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it.each([
    ['스킴 누락', 'hooks.example.test/abc'],
    ['http(평문)', 'http://hooks.example.test/abc'],
    ['file 스킴', 'file:///etc/passwd'],
    ['localhost', 'https://localhost:9000/hook'],
    ['루프백 IP', 'https://127.0.0.1/hook'],
    ['사설 IP(10/8)', 'https://10.1.2.3/hook'],
    ['사설 IP(172.16/12)', 'https://172.20.0.5/hook'],
    ['사설 IP(192.168/16)', 'https://192.168.0.9/hook'],
    ['클라우드 메타데이터', 'https://169.254.169.254/latest/meta-data'],
    ['IPv6 루프백', 'https://[::1]/hook'],
    ['IPv4-mapped IPv6 루프백', 'https://[::ffff:127.0.0.1]/hook'],
    ['내부 도메인', 'https://redis.internal/hook'],
  ])('보내면 안 되는 수집처(%s)는 미설정과 같이 501 — SSRF 통로가 되지 않게', async (_l, url) => {
    vi.stubEnv('FEEDBACK_WEBHOOK_URL', url);
    const res = await POST(post({ category: 'general', content: '내용' }));
    expect(res.status).toBe(501);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('리다이렉트를 따라가지 않는다 — 3xx 는 성공이 아니다(내부로 튕기는 경로 차단)', async () => {
    vi.stubEnv('FEEDBACK_WEBHOOK_URL', WEBHOOK);
    sendMock.mockResolvedValue(302);
    const res = await POST(post({ category: 'general', content: '내용' }));
    expect(res.status).toBe(502);
    expect((await res.json()).code).toBe('FEEDBACK_SINK_FAILED');
  });

  it('연결은 **DNS 로 확인한 그 주소**로 고정해 보낸다(확인 후 재해석 금지)', async () => {
    vi.stubEnv('FEEDBACK_WEBHOOK_URL', WEBHOOK);
    dnsLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    await POST(post({ category: 'general', content: '내용' }));
    const [url, address] = sendMock.mock.calls[0] as [URL, string];
    expect(url.href).toBe(WEBHOOK);
    expect(address).toBe('93.184.216.34');
  });

  it('공인 도메인이 내부 주소로 해석되면 보내지 않는다(127.0.0.1.nip.io 류)', async () => {
    vi.stubEnv('FEEDBACK_WEBHOOK_URL', 'https://127.0.0.1.nip.io/hook');
    dnsLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
    const res = await POST(post({ category: 'general', content: '내용' }));
    expect(res.status).toBe(501);
    expect((await res.json()).code).toBe('FEEDBACK_SINK_NOT_ALLOWED');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('DNS 해석이 실패하면 보내지 않는다(모르면 보내지 않는다)', async () => {
    vi.stubEnv('FEEDBACK_WEBHOOK_URL', WEBHOOK);
    dnsLookup.mockRejectedValue(new Error('ENOTFOUND'));
    const res = await POST(post({ category: 'general', content: '내용' }));
    expect(res.status).toBe(501);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('allowlist 를 켜면 그 밖의 호스트는 거절', async () => {
    vi.stubEnv('FEEDBACK_WEBHOOK_URL', 'https://evil.example.com/hook');
    vi.stubEnv('FEEDBACK_WEBHOOK_ALLOWED_HOSTS', 'hooks.slack.com');
    const res = await POST(post({ category: 'general', content: '내용' }));
    expect(res.status).toBe(501);
    expect((await res.json()).code).toBe('FEEDBACK_SINK_NOT_CONFIGURED');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('allowlist 안의 호스트는 통과', async () => {
    vi.stubEnv('FEEDBACK_WEBHOOK_URL', 'https://hooks.slack.com/services/T0/B0/x');
    vi.stubEnv('FEEDBACK_WEBHOOK_ALLOWED_HOSTS', 'hooks.slack.com');
    expect((await POST(post({ category: 'general', content: '내용' }))).status).toBe(202);
  });

  it('프로덕션에서 allowlist 미설정이면 보내지 않는다 — DNS 리바인딩 틈을 닫는 최소 조건', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RATE_LIMIT_BACKEND', 'memory');
    vi.stubEnv('TRUSTED_CLIENT_IP_HEADER', 'x-vercel-forwarded-for');
    vi.stubEnv('FEEDBACK_WEBHOOK_URL', WEBHOOK);
    const res = await POST(
      post({ category: 'general', content: '내용' }, { 'x-vercel-forwarded-for': '203.0.113.7' }),
    );
    expect(res.status).toBe(501);
    expect((await res.json()).code).toBe('FEEDBACK_SINK_ALLOWLIST_REQUIRED');
    expect(sendMock).not.toHaveBeenCalled();
  });
});

// 인증이 없는 라우트라 CSRF 토큰이 없다. 남의 사이트가 방문자 브라우저로 이 주소에 POST 해서
// **피해자 IP 의 버킷을 대신 소모**시키는 경로를 막는다(모으면 호출자별 한도 우회 + 수집처 스팸).
describe('POST /api/feedback — 교차 출처 차단', () => {
  beforeEach(() => vi.stubEnv('FEEDBACK_WEBHOOK_URL', WEBHOOK));

  it.each([['cross-site'], ['same-site'], ['cross-origin' as string]])(
    'Sec-Fetch-Site: %s → 403, 레이트리밋도 소비하지 않는다',
    async (site) => {
      const res = await POST(
        post({ category: 'general', content: '내용' }, { 'sec-fetch-site': site }),
      );
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe('CROSS_ORIGIN_REJECTED');
      expect(sendMock).not.toHaveBeenCalled();
      // 같은 IP 의 정상 요청은 여전히 3회 통과해야 한다(버킷이 소모되지 않았다).
      for (let i = 0; i < 3; i++) {
        expect((await POST(post({ category: 'general', content: '내용' }))).status).toBe(202);
      }
    },
  );

  it.each([['same-origin'], ['none']])('Sec-Fetch-Site: %s 는 통과', async (site) => {
    const res = await POST(
      post({ category: 'general', content: '내용' }, { 'sec-fetch-site': site }),
    );
    expect(res.status).toBe(202);
  });

  it('Origin 이 다른 호스트면 403(Sec-Fetch-Site 없는 구형 브라우저 폴백)', async () => {
    const res = await POST(
      post({ category: 'general', content: '내용' }, { origin: 'https://evil.example.com' }),
    );
    expect(res.status).toBe(403);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('Origin 이 같은 호스트면 통과', async () => {
    const res = await POST(
      post({ category: 'general', content: '내용' }, { origin: 'http://localhost:3007' }),
    );
    expect(res.status).toBe(202);
  });

  it.each([
    ['text/plain', 'text/plain'],
    ['form 인코딩', 'application/x-www-form-urlencoded'],
    ['multipart', 'multipart/form-data'],
    ['빈 값', ''],
  ])('CORS 프리플라이트 없이 보낼 수 있는 타입(%s)은 415', async (_l, type) => {
    const req = new Request('http://localhost:3007/api/feedback', {
      method: 'POST',
      headers: type ? { 'content-type': type } : {},
      body: JSON.stringify({ category: 'general', content: '내용' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(415);
    expect((await res.json()).code).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('charset 이 붙은 application/json 은 통과', async () => {
    const res = await POST(
      post({ category: 'general', content: '내용' }, { 'content-type': 'application/json; charset=utf-8' }),
    );
    expect(res.status).toBe(202);
  });
});

describe('POST /api/feedback — 입력 검증', () => {
  beforeEach(() => vi.stubEnv('FEEDBACK_WEBHOOK_URL', WEBHOOK));

  it.each([
    ['빈 내용', { category: 'general', content: '' }],
    ['공백만 있는 내용', { category: 'general', content: '   ' }],
    ['1001자', { category: 'general', content: 'ㄱ'.repeat(1001) }],
    ['목록에 없는 카테고리', { category: 'urgent', content: '내용' }],
    ['카테고리 누락', { content: '내용' }],
    ['내용 누락', { category: 'bug' }],
  ])('스키마 위반(%s) → 400 + 전달 시도 없음', async (_label, body) => {
    const res = await POST(post(body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe('INVALID_BODY');
    expect(Array.isArray(json.issues)).toBe(true);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('JSON 이 아니면 400 INVALID_JSON', async () => {
    const res = await POST(post('내용만 덜렁'));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('INVALID_JSON');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('content-length 가 상한을 넘으면 읽기 전에 413', async () => {
    const res = await POST(
      post({ category: 'general', content: '내용' }, { 'content-length': String(9 * 1024) }),
    );
    expect(res.status).toBe(413);
    expect((await res.json()).code).toBe('PAYLOAD_TOO_LARGE');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('헤더가 없어도 실제 본문이 상한을 넘으면 413', async () => {
    // content-length 는 신뢰할 수 없다(없거나 거짓일 수 있다) — 읽은 바이트로 다시 잰다.
    const res = await POST(post({ category: 'general', content: 'a'.repeat(20_000) }));
    expect(res.status).toBe(413);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('content-length 없는 대용량 스트림은 **읽는 도중에** 끊긴다(전부 버퍼링하지 않는다)', async () => {
    // chunked 요청은 content-length 를 아예 보내지 않는다. 다 읽고 나서 재는 구현이면
    // 이 시점에 이미 수십 MB 가 메모리에 들어와 있다 — 그래서 청크 단위로 끊어야 한다.
    const CHUNK = 1024;
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        if (pulled > 200) {
          controller.close(); // 테스트가 무한히 돌지 않게 하는 안전장치(정상 경로면 닿지 않는다)
          return;
        }
        controller.enqueue(new Uint8Array(CHUNK).fill(0x61));
      },
    });
    const req = new Request('http://localhost:3007/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: stream,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });

    const res = await POST(req);
    expect(res.status).toBe(413);
    // 8KB 상한 = 청크 9개 언저리에서 취소돼야 한다. 안전장치(200)에 닿았다면 끊지 못한 것이다.
    expect(pulled).toBeLessThan(20);
    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/feedback — 전달', () => {
  beforeEach(() => vi.stubEnv('FEEDBACK_WEBHOOK_URL', WEBHOOK));

  it('정상 제출 → 202 + 수집처로 카테고리·내용 전달', async () => {
    const res = await POST(
      post({ category: 'bug', content: '탭을 바꾸면 스크롤이 맨 위로 올라가요.' }),
    );
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ ok: true });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const [url, , payload] = sendMock.mock.calls[0] as [URL, string, { text: string }];
    expect(url.href).toBe(WEBHOOK);
    expect(payload.text).toContain('버그 신고'); // 선택한 카테고리가 라벨로 실린다
    expect(payload.text).toContain('탭을 바꾸면 스크롤이 맨 위로 올라가요.');
  });

  it('Slack 멘션 토큰은 이스케이프해서 보낸다(한 줄로 채널 전원 알림을 울리지 못하게)', async () => {
    await POST(
      post({ category: 'general', content: '<!channel> <@U12345> 급해요 & <!here>' }),
    );
    const [, , payload] = sendMock.mock.calls[0] as [URL, string, { text: string; mrkdwn: boolean }];
    expect(payload.text).not.toContain('<!channel>');
    expect(payload.text).not.toContain('<@U12345>');
    expect(payload.text).toContain('&lt;!channel&gt;');
    expect(payload.text).toContain('&lt;@U12345&gt;');
    expect(payload.text).toContain('&amp;');
    expect(payload.mrkdwn).toBe(false); // 수집처가 지원하면 서식 해석 자체를 끈다
  });

  it('선언하지 않은 키는 수집처로 새어 나가지 않는다', async () => {
    await POST(post({ category: 'general', content: '내용', sessionToken: 'leak-me' }));
    const [, , payload] = sendMock.mock.calls[0] as [URL, string, unknown];
    expect(JSON.stringify(payload)).not.toContain('leak-me');
  });

  it('수집처가 실패 응답 → 502(성공으로 위장하지 않는다)', async () => {
    sendMock.mockResolvedValue(404);
    const res = await POST(post({ category: 'general', content: '내용' }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.code).toBe('FEEDBACK_SINK_FAILED');
    expect(body.ok).toBe(false);
    // 수집처 응답 본문은 그대로 흘리지 않는다(상태 코드만 본다).
    expect(JSON.stringify(body)).not.toContain('404');
  });

  it('수집처 연결 실패 → 502', async () => {
    sendMock.mockRejectedValue(new Error('ECONNREFUSED'));
    const res = await POST(post({ category: 'general', content: '내용' }));
    expect(res.status).toBe(502);
    expect((await res.json()).code).toBe('FEEDBACK_SINK_UNREACHABLE');
  });
});

// 이 라우트는 인증이 없다 — 누구나 부를 수 있으므로 남용 방어가 유일한 보호막이다.
// 방어가 사라지면 서버가 외부 발송 프록시가 되므로, 거절 경로를 명시적으로 못박는다.
describe('POST /api/feedback — 남용 가드', () => {
  const from = (ip: string) => ({ 'x-forwarded-for': ip });

  beforeEach(() => vi.stubEnv('FEEDBACK_WEBHOOK_URL', WEBHOOK));

  it('같은 IP 가 버스트 한도(3회/분)를 넘기면 429 + Retry-After, 전달하지 않는다', async () => {
    const body = { category: 'general', content: '내용' };
    for (let i = 0; i < 3; i++) {
      expect((await POST(post(body, from('203.0.113.7')))).status).toBe(202);
    }
    const res = await POST(post(body, from('203.0.113.7')));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe('RATE_LIMITED');
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(sendMock).toHaveBeenCalledTimes(3); // 4번째는 수집처로 나가지 않았다
  });

  it('다른 IP 는 서로의 한도에 걸리지 않는다', async () => {
    const body = { category: 'general', content: '내용' };
    for (let i = 0; i < 3; i++) await POST(post(body, from('203.0.113.7')));
    expect((await POST(post(body, from('198.51.100.9')))).status).toBe(202);
  });

  it('x-forwarded-for 가 없으면 x-real-ip 를 쓴다', async () => {
    const body = { category: 'general', content: '내용' };
    for (let i = 0; i < 3; i++) {
      await POST(post(body, { 'x-real-ip': '203.0.113.10' }));
    }
    expect((await POST(post(body, { 'x-real-ip': '203.0.113.10' }))).status).toBe(429);
  });

  it('막힌 요청은 전체 상한을 소비하지 않는다(한 IP 의 폭주가 모두를 막지 않게)', async () => {
    const body = { category: 'general', content: '내용' };
    // 한 IP 로 20회 시도 → 3회만 통과하고 17회는 429. 그 17회가 전체 카운터를 갉아먹으면 안 된다.
    for (let i = 0; i < 20; i++) await POST(post(body, from('203.0.113.7')));
    // 다른 IP 들이 여전히 정상적으로 통과해야 한다.
    for (let i = 0; i < 5; i++) {
      const res = await POST(post(body, from(`198.51.100.${i}`)));
      expect(res.status).toBe(202);
    }
  });

  it('유효하지 않은 요청은 전체 상한을 소비하지 않는다(IP 를 갈아 끼운 쓰레기 요청으로 서비스를 막을 수 없다)', async () => {
    // 전체 상한을 검증 전에 깎으면, 깨진 요청을 식별자만 바꿔 상한 넘게 보내는 것만으로
    // 정상 사용자를 막을 수 있다. 전체 카운터는 **유효한 제출**에서만 줄어야 한다.
    for (let i = 0; i < 40; i++) {
      const ip = `192.0.2.${i % 200}`;
      const res =
        i % 2 === 0
          ? await POST(post('not json', from(ip))) // JSON 아님
          : await POST(post({ category: 'nope', content: '' }, from(ip))); // 스키마 위반
      expect(res.status).toBe(400);
    }
    const ok = await POST(post({ category: 'general', content: '내용' }, from('198.51.100.77')));
    expect(ok.status).toBe(202);
  });

  it('전체 상한(30회/5분)을 넘기면 유효한 제출도 429', async () => {
    const body = { category: 'general', content: '내용' };
    // 식별자를 바꿔 가며 30회 통과 → 31번째는 전체 상한에 걸린다.
    for (let i = 0; i < 30; i++) {
      expect((await POST(post(body, from(`192.0.2.${i}`)))).status).toBe(202);
    }
    const res = await POST(post(body, from('192.0.2.200')));
    expect(res.status).toBe(429);
    expect(sendMock).toHaveBeenCalledTimes(30); // 31번째는 수집처로 나가지 않았다
    // 창이 5분이라 막혀도 곧 풀린다 — 한 번의 버스트로 서비스가 한 시간 닫히지 않게.
    expect(Number(res.headers.get('retry-after'))).toBeLessThanOrEqual(300);
  });

  it('프로덕션에서 리미터가 구성되지 않으면 열지 않고 503(fail-closed)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('TRUSTED_CLIENT_IP_HEADER', 'x-vercel-forwarded-for'); // 식별자 쪽은 구성됨
    const res = await POST(
      post({ category: 'general', content: '내용' }, { 'x-vercel-forwarded-for': '203.0.113.7' }),
    );
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('RATE_LIMIT_UNAVAILABLE');
    expect(sendMock).not.toHaveBeenCalled();
  });
});

// 호출자 식별자를 위조 가능한 헤더에서 그냥 읽으면, 매 요청 다른 값을 넣는 것만으로 한도가
// 통째로 무력화된다. 어떤 헤더를 신뢰할지는 **운영자가 선언**하고, 선언이 없는 프로덕션은 열지 않는다.
describe('POST /api/feedback — 호출자 식별자의 신뢰 경계', () => {
  beforeEach(() => {
    vi.stubEnv('FEEDBACK_WEBHOOK_URL', WEBHOOK);
    vi.stubEnv('FEEDBACK_WEBHOOK_ALLOWED_HOSTS', 'hooks.example.test'); // 프로덕션 필수 조건
    vi.stubEnv('RATE_LIMIT_BACKEND', 'memory');
  });

  it('프로덕션 + 신뢰 헤더 미선언 → 503(추측한 헤더로 도는 보호는 보호가 아니다)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const res = await POST(
      post({ category: 'general', content: '내용' }, { 'x-forwarded-for': '203.0.113.7' }),
    );
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('CLIENT_IP_SOURCE_NOT_CONFIGURED');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('선언된 헤더만 본다 — x-forwarded-for 를 갈아 끼워도 한도를 벗어나지 못한다', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('TRUSTED_CLIENT_IP_HEADER', 'x-vercel-forwarded-for');
    const body = { category: 'general', content: '내용' };
    const spoof = (i: number) => ({
      'x-vercel-forwarded-for': '203.0.113.7', // 플랫폼이 넣는 값(고정)
      'x-forwarded-for': `198.51.100.${i}`, // 클라이언트가 갈아 끼우는 값
    });
    for (let i = 0; i < 3; i++) {
      expect((await POST(post(body, spoof(i)))).status).toBe(202);
    }
    expect((await POST(post(body, spoof(9)))).status).toBe(429);
  });

  it('선언된 헤더가 없는 요청은 공용 버킷에 모아 센다(예상 경로 밖)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('TRUSTED_CLIENT_IP_HEADER', 'x-vercel-forwarded-for');
    const body = { category: 'general', content: '내용' };
    for (let i = 0; i < 3; i++) {
      expect((await POST(post(body, { 'x-forwarded-for': `198.51.100.${i}` }))).status).toBe(202);
    }
    expect((await POST(post(body, { 'x-forwarded-for': '198.51.100.99' }))).status).toBe(429);
  });
});
