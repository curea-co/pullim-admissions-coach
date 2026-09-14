import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FEEDBACK_PAGE_URL_MAX } from '@pullim/shared';
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

/** 보낸 요청 본문. */
function sentBody() {
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return JSON.parse(String(init.body)) as {
    category: string;
    content: string;
    context?: { pageUrl: string; viewport: { w: number; h: number } };
  };
}

describe('submitFeedback — 정상 경로', () => {
  it('same-origin /api/feedback 으로 카테고리·내용을 보낸다', async () => {
    fetchMock.mockResolvedValue(json(202));
    const result = await submitFeedback({ category: 'feature', content: '검색에 최근 항목이 있으면 좋겠어요.' });

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/feedback');
    expect(init.method).toBe('POST');
    const body = sentBody();
    expect(body.category).toBe('feature');
    expect(body.content).toBe('검색에 최근 항목이 있으면 좋겠어요.');
  });

  it('앞뒤 공백은 다듬어 보낸다', async () => {
    fetchMock.mockResolvedValue(json(202));
    await submitFeedback({ category: 'general', content: '  내용  ' });
    expect(sentBody().content).toBe('내용');
  });
});

// 맥락은 폼이 아니라 여기서 붙인다. 담기는 것은 **경로와 뷰포트뿐** — 호스트도, 사용자 정보도 아니다.
describe('submitFeedback — 제출 맥락', () => {
  const setLocation = (href: string) => {
    window.history.replaceState({}, '', href);
  };

  beforeEach(() => {
    fetchMock.mockResolvedValue(json(202));
    setLocation('/');
  });

  it('현재 경로를 담는다 — **호스트는 담지 않는다**(서버가 안다)', async () => {
    setLocation('/result');
    await submitFeedback({ category: 'general', content: '내용' });

    const context = sentBody().context;
    expect(context?.pageUrl).toBe('/result');
    expect(context?.pageUrl).not.toContain(window.location.host);
    expect(context?.pageUrl.startsWith('/')).toBe(true);
  });

  // 쿼리에는 `?next=`·`?code=`·`?token=` 처럼 일회성 토큰·개인 정보가 실린다. 그대로 보내면
  // 그 값이 건의 레코드로 복제돼 admin 화면·백업에 남는다.
  it('쿼리는 담지 않는다 — 토큰·이메일이 건의 데이터로 복제되지 않게', async () => {
    setLocation('/login?next=/mypage&code=one-time-token&email=student@example.com');
    await submitFeedback({ category: 'general', content: '내용' });

    const body = sentBody();
    expect(body.context?.pageUrl).toBe('/login');
    expect(JSON.stringify(body)).not.toMatch(/one-time-token|student@example.com|next=/);
  });

  it('뷰포트는 정수 픽셀로 담는다', async () => {
    await submitFeedback({ category: 'general', content: '내용' });
    const viewport = sentBody().context?.viewport;
    expect(viewport).toEqual({ w: window.innerWidth, h: window.innerHeight });
    expect(Number.isInteger(viewport?.w)).toBe(true);
  });

  it('해시(#)도 담지 않는다 — 서버로 보낼 이유가 없는 클라이언트 전용 값이다', async () => {
    setLocation('/result#card-3');
    await submitFeedback({ category: 'general', content: '내용' });
    expect(sentBody().context?.pageUrl).toBe('/result');
  });

  it('아주 긴 경로는 **잘라서** 보낸다(맥락 때문에 제출이 막히지 않게)', async () => {
    setLocation(`/submit/${'a'.repeat(2_000)}`);
    const result = await submitFeedback({ category: 'general', content: '내용' });

    expect(result).toEqual({ ok: true });
    expect(sentBody().context?.pageUrl).toHaveLength(FEEDBACK_PAGE_URL_MAX);
  });

  it('맥락에 사용자 정보를 담지 않는다(경로·뷰포트 두 키뿐)', async () => {
    await submitFeedback({ category: 'general', content: '내용' });
    expect(Object.keys(sentBody().context ?? {}).sort()).toEqual(['pageUrl', 'viewport']);
  });
});

describe('submitFeedback — 실패는 실패로', () => {
  it('빈 내용은 왕복 없이 거절', async () => {
    const result = await submitFeedback({ category: 'general', content: '   ' });
    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('501(저장 표면 미설정) → 원인을 밝힌 문구', async () => {
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

  it('503(접수를 잠시 멈춤) → 사용자 잘못이 아님을 밝힌 문구', async () => {
    fetchMock.mockResolvedValue(json(503));
    const result = await submitFeedback({ category: 'general', content: '내용' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('잠시 멈춰');
  });

  it('502 → 서버 전달 실패', async () => {
    fetchMock.mockResolvedValue(json(502));
    const result = await submitFeedback({ category: 'general', content: '내용' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('잠시 뒤');
  });

  it('408(본문이 다 도착하지 않음) → 연결 상태를 확인하라는 처방', async () => {
    fetchMock.mockResolvedValue(json(408));
    const result = await submitFeedback({ category: 'general', content: '내용' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('네트워크');
  });

  it('네트워크 실패 → 연결 상태를 확인하라는 처방', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const result = await submitFeedback({ category: 'general', content: '내용' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('네트워크');
  });

  it('어떤 실패 문구에도 §6 금칙어(정답·합격·대본)가 없다', async () => {
    for (const status of [400, 403, 408, 413, 415, 429, 500, 501, 502, 503]) {
      fetchMock.mockResolvedValue(json(status));
      const result = await submitFeedback({ category: 'general', content: '내용' });
      if (!result.ok) {
        expect(result.message).not.toMatch(/정답|합격|대본/);
      }
    }
  });
});
