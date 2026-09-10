import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isFeedbackEnabled, submitFeedback } from './feedback';

// 전송 클라이언트 계약. 핵심은 **실패를 실패로 돌려주는 것** — 서버가 501/502 를 주거나 네트워크가
// 끊겼는데 ok:true 를 돌려주면 화면이 "접수했어요"로 넘어가 사용자에게 거짓말을 하게 된다.
// env 는 feedback.ts 가 함수 안에서 읽으므로 stubEnv 로 갈아끼울 수 있다(모듈 상수 캐시 금지).

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const json = (status: number) => new Response(JSON.stringify({ ok: status < 400 }), { status });

describe('isFeedbackEnabled', () => {
  it("정확히 'true' 일 때만 켠다", () => {
    vi.stubEnv('NEXT_PUBLIC_FEEDBACK_ENABLED', 'true');
    expect(isFeedbackEnabled()).toBe(true);
  });

  it.each(['', 'false', 'TRUE', '1', 'yes'])('그 밖의 값(%s)은 꺼진 상태', (value) => {
    vi.stubEnv('NEXT_PUBLIC_FEEDBACK_ENABLED', value);
    expect(isFeedbackEnabled()).toBe(false);
  });

  it('기본(미설정)은 꺼진 상태 — 켜야 보인다', () => {
    vi.stubEnv('NEXT_PUBLIC_FEEDBACK_ENABLED', undefined as unknown as string);
    expect(isFeedbackEnabled()).toBe(false);
  });
});

describe('submitFeedback — 정상 경로', () => {
  it('same-origin /api/feedback 으로 카테고리·내용을 보낸다', async () => {
    fetchMock.mockResolvedValue(json(202));
    const result = await submitFeedback({ category: 'feature', content: '검색에 최근 항목이 있으면 좋겠어요.' });

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/feedback');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      category: 'feature',
      content: '검색에 최근 항목이 있으면 좋겠어요.',
    });
  });

  it('앞뒤 공백은 다듬어 보낸다', async () => {
    fetchMock.mockResolvedValue(json(202));
    await submitFeedback({ category: 'general', content: '  내용  ' });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body)).content).toBe('내용');
  });
});

describe('submitFeedback — 실패는 실패로', () => {
  it('빈 내용은 왕복 없이 거절', async () => {
    const result = await submitFeedback({ category: 'general', content: '   ' });
    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('501(수집처 미설정) → 원인을 밝힌 문구', async () => {
    fetchMock.mockResolvedValue(json(501));
    const result = await submitFeedback({ category: 'general', content: '내용' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('연결되어 있지 않아');
  });

  it('413 → 길이를 줄이라는 처방', async () => {
    fetchMock.mockResolvedValue(json(413));
    const result = await submitFeedback({ category: 'general', content: '내용' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('1000자');
  });

  it('400 → 형식 오류', async () => {
    fetchMock.mockResolvedValue(json(400));
    const result = await submitFeedback({ category: 'general', content: '내용' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('형식');
  });

  it('429(너무 잦은 전송) → 잠시 뒤 다시 시도하라는 처방', async () => {
    fetchMock.mockResolvedValue(json(429));
    const result = await submitFeedback({ category: 'general', content: '내용' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('여러 번');
  });

  it.each([403, 415])('%s(교차 출처·형식 거절) → 새로고침 안내', async (status) => {
    fetchMock.mockResolvedValue(json(status));
    const result = await submitFeedback({ category: 'general', content: '내용' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('새로고침');
  });

  it('502 → 서버 전달 실패', async () => {
    fetchMock.mockResolvedValue(json(502));
    const result = await submitFeedback({ category: 'general', content: '내용' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('잠시 뒤');
  });

  it('네트워크 실패 → 연결 상태를 확인하라는 처방', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const result = await submitFeedback({ category: 'general', content: '내용' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('네트워크');
  });

  it('어떤 실패 문구에도 §6 금칙어(정답·합격·대본)가 없다', async () => {
    for (const status of [400, 403, 413, 415, 429, 500, 501, 502, 503]) {
      fetchMock.mockResolvedValue(json(status));
      const result = await submitFeedback({ category: 'general', content: '내용' });
      if (!result.ok) {
        expect(result.message).not.toMatch(/정답|합격|대본/);
      }
    }
  });
});
