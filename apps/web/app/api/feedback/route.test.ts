import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';

// 수신 라우트 계약 고정. 핵심은 **정직성**이다 — 저장되지 않았으면 성공을 돌려주지 않는다.
// (구성 미설정 501 / api 실패 502). 그 다음이 남용 방어(레이트리밋·본문 크기)와 입력 방어,
// 그리고 **저장 값의 경계**다(신원은 서버가 정한 userId 하나뿐, 프로필은 담기지 않는다).

const API_URL = 'https://api.example.test';
const SERVICE_KEY = 'svc-key-123';

/** 저장 표면 구성. 이 값들이 없으면 라우트는 501 로 끝낸다. */
function configureApi() {
  vi.stubEnv('PULLIM_API_URL', API_URL);
  vi.stubEnv('FEEDBACK_SERVICE_KEY', SERVICE_KEY);
}

/** 라우트가 받는 것은 표준 Request 다. 헤더를 직접 넣어야 하는 케이스(content-length)도 있어 옵션으로 연다. */
function post(body: string | object, headers: Record<string, string> = {}) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return new Request('http://localhost:3007/api/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: raw,
  });
}

/** 라우트가 api 로 보낸 payload(첫 호출). */
function sentPayload() {
  return sendMock.mock.calls[0][1] as Record<string, unknown> & {
    context: Record<string, unknown>;
  };
}

// api 로의 실제 POST 만 mock 한다 — 여기서 확인할 것은 **라우트의 판단과 payload** 다.
// 헤더·리다이렉트 등 전송 자체의 형태는 lib/feedback-api.test.ts 가 본다.
// (부분 mock: 구성 해석·신원 확인은 실제 코드가 돌아야 501/userId 경로를 진짜로 검증한다.)
const sendMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/feedback-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/feedback-api')>()),
  postFeedbackToApi: sendMock,
}));

// 라우트는 프로세스 수명 동안 유지되는 레이트리밋 싱글톤을 쓴다. 테스트마다 모듈을 새로
// 불러 카운터를 0 에서 시작하게 한다 — 안 그러면 앞 테스트의 호출이 뒤 테스트를 429 로 만든다.
let POST: (req: Request) => Promise<Response>;

beforeEach(async () => {
  sendMock.mockReset();
  sendMock.mockResolvedValue(201);
  vi.resetModules();
  ({ POST } = await import('./route'));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('POST /api/feedback — 저장 표면 구성', () => {
  it('PULLIM_API_URL 미설정 → 501 + 어느 값이 없는지 그대로 말한다(조용한 성공 금지)', async () => {
    vi.stubEnv('PULLIM_API_URL', '');
    vi.stubEnv('FEEDBACK_SERVICE_KEY', SERVICE_KEY);
    const res = await POST(post({ category: 'general', content: '내용' }));
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe('FEEDBACK_SINK_NOT_CONFIGURED');
    expect(body.message).toContain('PULLIM_API_URL');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('FEEDBACK_SERVICE_KEY 미설정 → 501(키 없이 보내지 않는다)', async () => {
    vi.stubEnv('PULLIM_API_URL', API_URL);
    vi.stubEnv('FEEDBACK_SERVICE_KEY', '');
    const res = await POST(post({ category: 'general', content: '내용' }));
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.code).toBe('FEEDBACK_SINK_NOT_CONFIGURED');
    expect(body.message).toContain('FEEDBACK_SERVICE_KEY');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it.each([
    ['스킴 누락', 'api.example.test'],
    ['file 스킴', 'file:///etc/passwd'],
    ['빈 경로', '///'],
  ])('http(s) 가 아닌 주소(%s)는 501 — 어디로 보낼지 모르면 보내지 않는다', async (_l, url) => {
    vi.stubEnv('PULLIM_API_URL', url);
    vi.stubEnv('FEEDBACK_SERVICE_KEY', SERVICE_KEY);
    const res = await POST(post({ category: 'general', content: '내용' }));
    expect(res.status).toBe(501);
    expect((await res.json()).code).toBe('FEEDBACK_SINK_NOT_ALLOWED');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('원격 호스트의 평문 http 는 501 — 개발 환경에서도 서비스 키를 흘리지 않는다', async () => {
    vi.stubEnv('PULLIM_API_URL', 'http://api.example.test');
    vi.stubEnv('FEEDBACK_SERVICE_KEY', SERVICE_KEY);
    const res = await POST(post({ category: 'general', content: '내용' }));
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.code).toBe('FEEDBACK_SINK_NOT_ALLOWED');
    expect(body.message).toContain('https');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('로컬(loopback) http 는 통과한다 — 개발 환경이 막히지 않게', async () => {
    vi.stubEnv('PULLIM_API_URL', 'http://localhost:3000');
    vi.stubEnv('FEEDBACK_SERVICE_KEY', SERVICE_KEY);
    expect((await POST(post({ category: 'general', content: '내용' }))).status).toBe(202);
  });

  it('구성이 갖춰지면 202 로 접수한다', async () => {
    configureApi();
    expect((await POST(post({ category: 'general', content: '내용' }))).status).toBe(202);
  });
});

// 인증이 없는 라우트라 CSRF 토큰이 없다. 남의 사이트가 방문자 브라우저로 이 주소에 POST 해서
// **피해자 IP 의 버킷을 대신 소모**시키는 경로를 막는다(모으면 호출자별 한도 우회 + 저장소 스팸).
describe('POST /api/feedback — 교차 출처 차단', () => {
  beforeEach(configureApi);

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

  it('Origin 이 같은 origin 이면 통과', async () => {
    const res = await POST(
      post({ category: 'general', content: '내용' }, { origin: 'http://localhost:3007' }),
    );
    expect(res.status).toBe(202);
  });

  it('호스트가 같아도 **스킴이 다르면** 403(http://… 는 https://… 와 다른 origin)', async () => {
    const req = new Request('https://pullim.ai/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://pullim.ai' },
      body: JSON.stringify({ category: 'general', content: '내용' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('포트가 다르면 403', async () => {
    const res = await POST(
      post({ category: 'general', content: '내용' }, { origin: 'http://localhost:4000' }),
    );
    expect(res.status).toBe(403);
  });

  it('TLS 종단이 프록시에 있으면 x-forwarded-proto 를 기준으로 본다(정상 요청을 막지 않게)', async () => {
    // 서버가 보는 req.url 은 http 지만 클라이언트가 본 origin 은 https 다.
    const req = new Request('http://internal-host/api/feedback', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://pullim.ai',
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'pullim.ai',
      },
      body: JSON.stringify({ category: 'general', content: '내용' }),
    });
    expect((await POST(req)).status).toBe(202);
  });

  it.each([
    ['text/plain', 'text/plain'],
    ['form 인코딩', 'application/x-www-form-urlencoded'],
    ['multipart', 'multipart/form-data'],
    ['application/jsonp — JSON 이 아니다', 'application/jsonp'],
    ['application/json-seq — JSON 이 아니다', 'application/json-seq'],
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
  beforeEach(configureApi);

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

  it('연결만 잡고 본문을 보내지 않으면 마감 시간에 끊고 408(slow loris)', async () => {
    // 크기만 재고 시간을 재지 않으면 이 요청은 여기서 무기한 대기한다 — 공개 라우트에서는
    // 호출자 키만 바꿔 반복하는 것만으로 워커·연결이 고갈된다.
    vi.useFakeTimers();
    try {
      let cancelled = false;
      const stream = new ReadableStream<Uint8Array>({
        start() {}, // 아무것도 보내지 않고, 닫지도 않는다
        cancel() {
          cancelled = true;
        },
      });
      const req = new Request('http://localhost:3007/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: stream,
        duplex: 'half',
      } as RequestInit & { duplex: 'half' });

      const pending = POST(req);
      await vi.advanceTimersByTimeAsync(6_000);
      const res = await pending;

      expect(res.status).toBe(408);
      expect((await res.json()).code).toBe('BODY_READ_TIMEOUT');
      expect(cancelled).toBe(true); // 기다리다 만 스트림을 붙잡고 있지 않는다
      expect(sendMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
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

describe('POST /api/feedback — 저장 payload 계약', () => {
  beforeEach(configureApi);

  it('정상 제출 → 202 + api 로 service/category/content 저장', async () => {
    const res = await POST(
      post({ category: 'bug', content: '탭을 바꾸면 스크롤이 맨 위로 올라가요.' }),
    );
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ ok: true });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const [target, payload] = sendMock.mock.calls[0] as [
      { endpoint: URL; serviceKey: string },
      Record<string, unknown>,
    ];
    expect(target.endpoint.href).toBe(`${API_URL}/feedback`);
    expect(target.serviceKey).toBe(SERVICE_KEY);
    expect(payload.service).toBe('admissions'); // 어느 서비스의 건의인지 고정값
    expect(payload.category).toBe('bug'); // 라벨이 아니라 **코드**로 저장한다
    expect(payload.content).toBe('탭을 바꾸면 스크롤이 맨 위로 올라가요.');
  });

  it('사용자가 적은 내용은 **가공하지 않고** 그대로 저장한다(표시 단계의 이스케이프와 섞지 않는다)', async () => {
    await POST(post({ category: 'general', content: '<b>급해요</b> & <!channel>' }));
    expect(sentPayload().content).toBe('<b>급해요</b> & <!channel>');
  });

  it('맥락: 경로·뷰포트는 클라이언트 값, user-agent 는 **요청 헤더**에서 채운다', async () => {
    await POST(
      post(
        {
          category: 'general',
          content: '내용',
          context: { pageUrl: '/result', viewport: { w: 390, h: 844 } },
        },
        { 'user-agent': 'Mozilla/5.0 (iPhone)' },
      ),
    );
    expect(sentPayload().context).toEqual({
      pageUrl: '/result',
      userAgent: 'Mozilla/5.0 (iPhone)',
      viewport: { w: 390, h: 844 },
    });
  });

  // 쿼리에는 일회성 토큰·이메일·복귀 주소가 실린다. 클라이언트가 통째로 보내도(옛 번들·변조)
  // **서버가 저장하는 값에는 남지 않는다** — 스키마가 경로만 남긴다.
  it('경로의 쿼리·해시는 저장하지 않는다(토큰·이메일이 건의로 복제되지 않게)', async () => {
    await POST(
      post({
        category: 'general',
        content: '내용',
        context: {
          pageUrl: '/login?next=/mypage&code=one-time-token&email=student@example.com#frag',
          viewport: { w: 390, h: 844 },
        },
      }),
    );
    const context = sentPayload().context;
    expect(context.pageUrl).toBe('/login');
    expect(JSON.stringify(context)).not.toMatch(/one-time-token|student@example.com|next=|#frag/);
  });

  it('클라이언트가 보낸 user-agent 는 무시한다(헤더가 더 믿을 만하다)', async () => {
    await POST(
      post(
        {
          category: 'general',
          content: '내용',
          context: {
            pageUrl: '/submit',
            viewport: { w: 390, h: 844 },
            userAgent: 'I-am-whoever-I-say',
          },
        },
        { 'user-agent': 'Mozilla/5.0 (iPhone)' },
      ),
    );
    expect(sentPayload().context.userAgent).toBe('Mozilla/5.0 (iPhone)');
  });

  it('맥락 없이 온 제출(옛 번들)도 저장한다 — 맥락은 필수 값이 아니다', async () => {
    const res = await POST(post({ category: 'general', content: '내용' }, { 'user-agent': 'UA/1.0' }));
    expect(res.status).toBe(202);
    const context = sentPayload().context;
    expect(context).toEqual({ userAgent: 'UA/1.0' });
    // 모르는 값은 빈 문자열로 채우지 않는다 — 키 자체가 없다.
    expect('pageUrl' in context).toBe(false);
    expect('viewport' in context).toBe(false);
  });

  it('appVersion 은 아는 환경에서만 실린다(없으면 키 자체가 없다)', async () => {
    const res1 = await POST(post({ category: 'general', content: '내용' }));
    expect(res1.status).toBe(202);
    expect('appVersion' in sentPayload().context).toBe(false);

    sendMock.mockClear();
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'deadbee');
    await POST(post({ category: 'general', content: '내용' }));
    expect(sentPayload().context.appVersion).toBe('deadbee');
  });

  it('신원을 확인할 수 없으면 userId 는 null — 비는 편이 낫다', async () => {
    await POST(post({ category: 'general', content: '내용' }));
    expect(sentPayload().userId).toBeNull();
  });

  it('클라이언트가 보낸 userId 는 **읽지도 않는다**(위조 차단)', async () => {
    await POST(post({ category: 'general', content: '내용', userId: 'u_victim' }));
    expect(sentPayload().userId).toBeNull();
    expect(JSON.stringify(sentPayload())).not.toContain('u_victim');
  });

  it('인증 쿠키가 확인되면 그 sub 를 userId 로 저장한다', async () => {
    vi.stubEnv('FEEDBACK_IDENTITY_COOKIES', 'pullim_at');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ sub: 'u_abc' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await POST(post({ category: 'general', content: '내용' }, { cookie: 'pullim_at=xyz' }));
    expect(sentPayload().userId).toBe('u_abc');
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${API_URL}/me`);
  });

  it('선언하지 않은 쿠키는 api 로 나가지 않는다 — 신원 확인 호출 자체가 없다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = await POST(
      post(
        { category: 'general', content: '내용' },
        { cookie: '__Host-web_csrf=c1; web_session=s1' },
      ),
    );
    expect(res.status).toBe(202);
    expect(sentPayload().userId).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('신원 확인이 실패해도 건의는 저장된다(있으면 좋은 값이 제출을 막지 않는다)', async () => {
    vi.stubEnv('FEEDBACK_IDENTITY_COOKIES', 'pullim_at');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ETIMEDOUT')));
    const res = await POST(post({ category: 'general', content: '내용' }, { cookie: 'pullim_at=xyz' }));
    expect(res.status).toBe(202);
    expect(sentPayload().userId).toBeNull();
  });

  // 오너 결정: 저장하는 신원은 userId 뿐이다. 이 테스트가 그 경계를 못박는다.
  it('이름·이메일·등급·미성년 여부는 **어떤 경로로도** payload 에 들어가지 않는다', async () => {
    vi.stubEnv('FEEDBACK_IDENTITY_COOKIES', 'pullim_at');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        // /me 가 프로필을 통째로 돌려줘도 우리가 꺼내는 것은 sub 하나뿐이다.
        new Response(
          JSON.stringify({
            sub: 'u_abc',
            email: 'student@example.com',
            displayName: '박준호',
            tier: 'premium',
            isMinor: true,
          }),
          { status: 200 },
        ),
      ),
    );

    await POST(
      post(
        {
          category: 'general',
          content: '내용',
          // 클라이언트가 프로필을 끼워 보내도 스키마가 걷어낸다.
          displayName: '박준호',
          email: 'student@example.com',
          tier: 'premium',
          isMinor: true,
          context: { pageUrl: '/submit', viewport: { w: 390, h: 844 }, email: 'leak@example.com' },
        },
        { cookie: 'pullim_at=xyz' },
      ),
    );

    const serialized = JSON.stringify(sentPayload());
    expect(serialized).not.toMatch(/displayName|email|tier|isMinor/);
    expect(serialized).not.toContain('박준호');
    expect(serialized).not.toContain('student@example.com');
    expect(serialized).not.toContain('leak@example.com');
    expect(sentPayload().userId).toBe('u_abc'); // 신원은 userId 하나로만 남는다
  });

  it('선언하지 않은 키는 api 로 새어 나가지 않는다', async () => {
    await POST(post({ category: 'general', content: '내용', sessionToken: 'leak-me' }));
    expect(JSON.stringify(sentPayload())).not.toContain('leak-me');
  });

  it('api 가 실패 응답 → 502(성공으로 위장하지 않는다 = 완료 화면으로 넘어가지 않는다)', async () => {
    sendMock.mockResolvedValue(500);
    const res = await POST(post({ category: 'general', content: '내용' }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.code).toBe('FEEDBACK_SINK_FAILED');
    expect(body.ok).toBe(false);
    // api 응답 본문은 그대로 흘리지 않는다(상태 코드만 본다).
    expect(JSON.stringify(body)).not.toContain('500');
  });

  it('api 가 3xx → 502(리다이렉트는 성공이 아니다)', async () => {
    sendMock.mockResolvedValue(302);
    const res = await POST(post({ category: 'general', content: '내용' }));
    expect(res.status).toBe(502);
    expect((await res.json()).code).toBe('FEEDBACK_SINK_FAILED');
  });

  it('api 연결 실패·타임아웃 → 502', async () => {
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

  beforeEach(configureApi);

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
    configureApi();
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
