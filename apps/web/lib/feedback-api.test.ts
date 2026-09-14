import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  appVersion,
  postFeedbackToApi,
  resolveFeedbackApiTarget,
  resolveUserId,
  type FeedbackApiPayload,
  type FeedbackApiTarget,
} from './feedback-api';

// 저장 표면 계약 고정. 여기서 지키는 것 세 가지:
//  ① 구성이 없거나 안전하지 않으면 **대상을 만들지 않는다**(라우트가 501 로 끝낸다).
//  ② 보내는 것은 계약에 선언된 필드뿐 — 신원은 userId 하나이고 프로필은 담기지 않는다.
//  ③ 신원은 **쿠키로만** 확인한다. 확인되지 않으면 null 이고, 그 실패가 건의를 막지 않는다.

const target: FeedbackApiTarget = {
  endpoint: new URL('https://api.example.test/feedback'),
  identityEndpoint: new URL('https://api.example.test/me'),
  serviceKey: 'svc-key-123',
};

const payload: FeedbackApiPayload = {
  service: 'admissions',
  category: 'bug',
  content: '탭을 바꾸면 스크롤이 맨 위로 올라가요.',
  userId: null,
  context: { pageUrl: '/result?tab=interview', userAgent: 'UA/1.0', viewport: { w: 390, h: 844 } },
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('resolveFeedbackApiTarget — 구성', () => {
  beforeEach(() => {
    vi.stubEnv('PULLIM_API_URL', 'https://api.example.test');
    vi.stubEnv('FEEDBACK_SERVICE_KEY', 'svc-key-123');
  });

  it('두 값이 있으면 /feedback·/me 주소를 만든다', () => {
    const r = resolveFeedbackApiTarget();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.target.endpoint.href).toBe('https://api.example.test/feedback');
    expect(r.target.identityEndpoint.href).toBe('https://api.example.test/me');
    expect(r.target.serviceKey).toBe('svc-key-123');
  });

  it('베이스의 경로를 버리지 않는다(https://host/api → /api/feedback)', () => {
    vi.stubEnv('PULLIM_API_URL', 'https://api.example.test/api/');
    const r = resolveFeedbackApiTarget();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.target.endpoint.href).toBe('https://api.example.test/api/feedback');
    expect(r.target.identityEndpoint.href).toBe('https://api.example.test/api/me');
  });

  it.each([
    ['PULLIM_API_URL', 'PULLIM_API_URL'],
    ['FEEDBACK_SERVICE_KEY', 'FEEDBACK_SERVICE_KEY'],
  ])('%s 가 비면 미구성 — 어느 값이 없는지 이름으로 말한다', (_label, name) => {
    vi.stubEnv(name, '');
    const r = resolveFeedbackApiTarget();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('not-configured');
    if (r.reason !== 'not-configured') return;
    expect(r.missing).toEqual([name]);
  });

  it('둘 다 비면 둘 다 이름을 댄다', () => {
    vi.stubEnv('PULLIM_API_URL', '   ');
    vi.stubEnv('FEEDBACK_SERVICE_KEY', '');
    const r = resolveFeedbackApiTarget();
    expect(r.ok).toBe(false);
    if (r.ok || r.reason !== 'not-configured') return;
    expect(r.missing).toEqual(['PULLIM_API_URL', 'FEEDBACK_SERVICE_KEY']);
  });

  it.each([
    ['스킴 누락', 'api.example.test'],
    ['빈 경로만', '///'],
    ['file 스킴', 'file:///etc/passwd'],
    ['javascript 스킴', 'javascript:alert(1)'],
  ])('http(s) 가 아닌 주소(%s)는 대상이 되지 않는다', (_label, url) => {
    vi.stubEnv('PULLIM_API_URL', url);
    const r = resolveFeedbackApiTarget();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('invalid-url');
  });

  it('개발에서는 http(로컬)를 허용한다', () => {
    vi.stubEnv('PULLIM_API_URL', 'http://localhost:3000');
    const r = resolveFeedbackApiTarget();
    expect(r.ok).toBe(true);
  });

  it('프로덕션에서 평문 http 는 거절 — 서비스 키가 그대로 흘러간다', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PULLIM_API_URL', 'http://api.example.test');
    const r = resolveFeedbackApiTarget();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('insecure');
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

describe('postFeedbackToApi — 전송 형태', () => {
  it('x-service-key 를 붙여 JSON 으로 POST 한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 201 }));
    const status = await postFeedbackToApi(target, payload, { timeoutMs: 5_000, fetchImpl: fetchMock });

    expect(status).toBe(201);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe('https://api.example.test/feedback');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-service-key']).toBe('svc-key-123');
    expect(headers['content-type']).toBe('application/json');
    expect(JSON.parse(String(init.body))).toEqual(payload);
    // 리다이렉트를 따라가면 서비스 키가 다른 호스트로 다시 나간다.
    expect(init.redirect).toBe('manual');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('상태 코드를 그대로 돌려준다 — 성공 판단은 호출부 몫(3xx 는 성공이 아니다)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 302 }));
    expect(await postFeedbackToApi(target, payload, { timeoutMs: 5_000, fetchImpl: fetchMock })).toBe(302);
  });

  it('연결 실패는 그대로 던진다(호출부가 502 로 바꾼다)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(
      postFeedbackToApi(target, payload, { timeoutMs: 5_000, fetchImpl: fetchMock }),
    ).rejects.toThrow();
  });

  it('본문에 프로필(이름·이메일·등급)이 섞일 자리가 없다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 201 }));
    await postFeedbackToApi(
      target,
      // 타입 밖의 값을 억지로 끼워도 **직렬화는 payload 그대로** 이므로, 이 테스트는 계약이
      // 넓어지는 순간(예: 라우트가 user 객체를 통째로 넘기는 변경) 함께 깨져야 한다.
      { ...payload, userId: 'u_1' },
      { timeoutMs: 5_000, fetchImpl: fetchMock },
    );
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['category', 'content', 'context', 'service', 'userId']);
    expect(JSON.stringify(body)).not.toMatch(/displayName|email|tier|isMinor/);
  });
});

describe('resolveUserId — 신원은 쿠키로만', () => {
  it('쿠키가 없으면 왕복 자체를 만들지 않는다', async () => {
    const fetchMock = vi.fn();
    expect(await resolveUserId(null, target, { timeoutMs: 2_000, fetchImpl: fetchMock })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('인증된 요청이면 /me 의 sub 를 쓴다 — 쿠키는 그대로 넘긴다', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ sub: 'u_abc', email: 'a@b.c' }), { status: 200 }));
    const userId = await resolveUserId('access=xyz; other=1', target, {
      timeoutMs: 2_000,
      fetchImpl: fetchMock,
    });

    expect(userId).toBe('u_abc');
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe('https://api.example.test/me');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>).cookie).toBe('access=xyz; other=1');
  });

  it.each([
    ['미인증(401)', 401],
    ['권한 없음(403)', 403],
    ['서버 오류(500)', 500],
    ['리다이렉트(302)', 302],
  ])('%s 는 "모른다" 로 본다 — null', async (_label, status) => {
    // 본문에 sub 가 **들어 있어도** 200 이 아니면 쓰지 않는다. api 가 오류 본문에 식별자를
    // 실어 보내는 경우(또는 로그인 페이지 HTML/JSON)에 남의 id 를 주워 담지 않게 하는 경계다.
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ sub: 'u_not_authenticated' }), { status }));
    expect(await resolveUserId('access=xyz', target, { timeoutMs: 2_000, fetchImpl: fetchMock })).toBeNull();
  });

  it.each([
    ['sub 없음', { email: 'a@b.c' }],
    ['sub 가 문자열이 아님', { sub: 12345 }],
    ['sub 가 공백', { sub: '   ' }],
  ])('%s → null(추측하지 않는다)', async (_label, body) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    expect(await resolveUserId('access=xyz', target, { timeoutMs: 2_000, fetchImpl: fetchMock })).toBeNull();
  });

  it('연결 실패·JSON 깨짐은 삼킨다 — 신원 확인 실패가 건의를 잃게 하지 않는다', async () => {
    const boom = vi.fn().mockRejectedValue(new Error('ETIMEDOUT'));
    expect(await resolveUserId('access=xyz', target, { timeoutMs: 2_000, fetchImpl: boom })).toBeNull();

    const broken = vi.fn().mockResolvedValue(new Response('not json', { status: 200 }));
    expect(await resolveUserId('access=xyz', target, { timeoutMs: 2_000, fetchImpl: broken })).toBeNull();
  });

  it('sub 가 길어도 저장값이 무한정 커지지 않게 자른다', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ sub: 'u'.repeat(500) }), { status: 200 }));
    const userId = await resolveUserId('access=xyz', target, { timeoutMs: 2_000, fetchImpl: fetchMock });
    expect(userId).toHaveLength(128);
  });
});
