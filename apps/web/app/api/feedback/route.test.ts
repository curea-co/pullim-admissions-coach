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

const fetchMock = vi.fn();

// 라우트는 프로세스 수명 동안 유지되는 레이트리밋 싱글톤을 쓴다. 테스트마다 모듈을 새로
// 불러 카운터를 0 에서 시작하게 한다 — 안 그러면 앞 테스트의 호출이 뒤 테스트를 429 로 만든다.
let POST: (req: Request) => Promise<Response>;

beforeEach(async () => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response('ok', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
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
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('스킴 없는 값도 미설정과 같이 501 — 형식이 깨진 URL 로는 전달할 수 없다', async () => {
    vi.stubEnv('FEEDBACK_WEBHOOK_URL', 'hooks.example.test/abc');
    const res = await POST(post({ category: 'general', content: '내용' }));
    expect(res.status).toBe(501);
    expect(fetchMock).not.toHaveBeenCalled();
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
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('JSON 이 아니면 400 INVALID_JSON', async () => {
    const res = await POST(post('내용만 덜렁'));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('INVALID_JSON');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('content-length 가 상한을 넘으면 읽기 전에 413', async () => {
    const res = await POST(
      post({ category: 'general', content: '내용' }, { 'content-length': String(9 * 1024) }),
    );
    expect(res.status).toBe(413);
    expect((await res.json()).code).toBe('PAYLOAD_TOO_LARGE');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('헤더가 없어도 실제 본문이 상한을 넘으면 413', async () => {
    // content-length 는 신뢰할 수 없다(없거나 거짓일 수 있다) — 읽은 바이트로 다시 잰다.
    const res = await POST(post({ category: 'general', content: 'a'.repeat(20_000) }));
    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
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
    expect(fetchMock).not.toHaveBeenCalled();
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

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(WEBHOOK);
    expect(init.method).toBe('POST');
    const sent = JSON.parse(String(init.body)) as { text: string };
    expect(sent.text).toContain('버그 신고'); // 선택한 카테고리가 라벨로 실린다
    expect(sent.text).toContain('탭을 바꾸면 스크롤이 맨 위로 올라가요.');
  });

  it('선언하지 않은 키는 수집처로 새어 나가지 않는다', async () => {
    await POST(post({ category: 'general', content: '내용', sessionToken: 'leak-me' }));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(init.body)).not.toContain('leak-me');
  });

  it('수집처가 실패 응답 → 502(성공으로 위장하지 않는다)', async () => {
    fetchMock.mockResolvedValue(new Response('no_service', { status: 404 }));
    const res = await POST(post({ category: 'general', content: '내용' }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.code).toBe('FEEDBACK_SINK_FAILED');
    expect(body.ok).toBe(false);
    // 수집처 응답 본문은 그대로 흘리지 않는다.
    expect(JSON.stringify(body)).not.toContain('no_service');
  });

  it('수집처 연결 실패 → 502', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
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
    expect(fetchMock).toHaveBeenCalledTimes(3); // 4번째는 수집처로 나가지 않았다
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

  it('프로덕션에서 리미터가 구성되지 않으면 열지 않고 503(fail-closed)', async () => {
    vi.stubEnv('NODE_ENV', 'production'); // RATE_LIMIT_BACKEND 미설정 → 리미터 init 실패
    const res = await POST(post({ category: 'general', content: '내용' }, from('203.0.113.7')));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('RATE_LIMIT_UNAVAILABLE');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
