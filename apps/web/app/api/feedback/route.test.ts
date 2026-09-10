import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { POST } from './route';

// 수신 라우트 계약 고정. 핵심은 **정직성**이다 — 전달되지 않았으면 성공을 돌려주지 않는다.
// (수집처 미설정 501 / 수집처 실패 502). 그 다음이 입력 방어(크기·JSON·스키마).

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

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response('ok', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
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
