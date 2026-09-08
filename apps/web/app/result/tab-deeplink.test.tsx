import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import ResultPage from './page';

// /result 의 `?tab=` 딥링크 회귀 고정.
//
// 왜 이 파일이 있나 — 결과 화면의 탭 선택은 URL 로 지목할 수 있어야 한다(⌘K 팔레트가
// `/result?tab=diagnosis` 로 보낸다). 그 동기화 로직은 눈에 잘 안 띄는 두 개의 장치에
// 의존하고 있어서, 테스트가 없으면 다음 사람이 "정리"하다가 조용히 부순다:
//
//   1) URL→탭 effect 에 **의존성 배열이 없다**. 빠뜨린 게 아니다. 이미 /result 에 있는
//      상태에서 팔레트가 router.push('/result?tab=…') 하면 컴포넌트는 remount 되지 않고
//      다시 렌더만 된다. `[]` 를 채워 넣는 순간 그 경로가 죽는다 → 아래 "remount 없이" 테스트.
//   2) effect 는 URL 의 **값**이 아니라 **변화**에만 반응한다(syncedSearchRef). 값에 반응하면
//      history.replaceState 가 실패했을 때 방금 누른 탭이 옛 주소로 되감긴다
//      → 아래 "주소 갱신 실패" 테스트.
//   3) tab 파라미터가 사라지거나 무효가 되면 **기본 탭으로 되돌린다**(`?? DEFAULT_TAB`).
//      `if (fromUrl) setTab(...)` 로 줄이면 주소는 기본 탭인데 화면은 이전 탭에 남는다
//      → 아래 "전이" 테스트 2건. (Codex PR #74 P1)
//
// 세 장치 모두 변이 검사(의존성 배열을 [] 로 · 가드 제거 · 폴백 제거)로 대응 테스트만
// 실제 실패하는 것을 확인했다.

vi.mock('@/components/auth/require-auth', () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// 실 auth 경로(hasAdmissionsAccess 선판정)를 타지 않게 해 서버 상태 분기를 배제한다 —
// 이 파일이 고정하려는 건 URL↔탭 동기화뿐이다.
vi.mock('@/lib/auth', () => ({ isPullimAuth: false }));

vi.mock('@/lib/admissions-api', () => ({
  // 서버 진단 없음(serverState=null) → 데모 패널과 탭이 그대로 렌더된다.
  fetchLatestDiagnosis: vi.fn().mockResolvedValue(null),
  loadLastResultId: vi.fn().mockReturnValue(null),
  saveLastResultId: vi.fn(),
  getDiagnosis: vi.fn(),
  toAnalyzeResult: vi.fn().mockReturnValue(null),
  hasAdmissionsAccess: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/submitted-profile', () => ({
  loadSubmittedProfile: vi.fn().mockReturnValue(null),
}));

// remount 여부를 관찰하는 창 — 마운트 1회 effect 안에서만 불린다.
const { loadSubmittedProfile } = await import('@/lib/submitted-profile');

const TAB_LABELS = ['학생부 종합 전형 면접 준비 팩', '생기부 진단 가이드', '부족 활동 보완안'];

const setUrl = (url: string) => window.history.replaceState(null, '', url);
const tabs = () => screen.getAllByRole('tab');
const selectedTab = () =>
  tabs().find((t) => t.getAttribute('aria-selected') === 'true')?.textContent;
const clickTab = (label: string) => fireEvent.click(screen.getByRole('tab', { name: label }));

beforeEach(() => {
  vi.clearAllMocks();
  setUrl('/result');
});

afterEach(() => {
  setUrl('/result');
});

describe('?tab= 딥링크 — 진입', () => {
  it('?tab=diagnosis 로 들어오면 생기부 진단 가이드 탭이 선택된 상태로 렌더된다', async () => {
    setUrl('/result?tab=diagnosis');
    render(<ResultPage />);
    await waitFor(() => expect(selectedTab()).toBe('생기부 진단 가이드'));
  });

  it('?tab=improvements → 부족 활동 보완안', async () => {
    setUrl('/result?tab=improvements');
    render(<ResultPage />);
    await waitFor(() => expect(selectedTab()).toBe('부족 활동 보완안'));
  });

  it('파라미터가 없으면 기본 탭(면접 준비 팩)', async () => {
    render(<ResultPage />);
    expect(tabs().map((t) => t.textContent)).toEqual(TAB_LABELS);
    expect(selectedTab()).toBe('학생부 종합 전형 면접 준비 팩');
  });

  it('알 수 없는 값은 조용히 기본 탭으로 떨어진다 — 에러 화면 없음', async () => {
    setUrl('/result?tab=nope');
    render(<ResultPage />);
    expect(selectedTab()).toBe('학생부 종합 전형 면접 준비 팩');
    // 잘못된 링크가 화면을 깨뜨리지 않는다: 탭도 본문도 정상 렌더.
    expect(tabs()).toHaveLength(3);
    expect(screen.getByRole('heading', { name: '진단 결과', level: 1 })).toBeInTheDocument();
  });

  it('빈 값(?tab=)도 기본 탭', async () => {
    setUrl('/result?tab=');
    render(<ResultPage />);
    expect(selectedTab()).toBe('학생부 종합 전형 면접 준비 팩');
  });
});

describe('?tab= 딥링크 — 탭 클릭', () => {
  it('탭을 누르면 선택이 바뀌고 URL 에 ?tab= 이 반영된다', async () => {
    render(<ResultPage />);
    clickTab('생기부 진단 가이드');
    expect(selectedTab()).toBe('생기부 진단 가이드');
    expect(window.location.search).toBe('?tab=diagnosis');

    clickTab('부족 활동 보완안');
    expect(selectedTab()).toBe('부족 활동 보완안');
    expect(window.location.search).toBe('?tab=improvements');
  });

  it('주소만 바꾼다 — 히스토리 길이가 늘지 않는다(replaceState)', async () => {
    render(<ResultPage />);
    const before = window.history.length;
    clickTab('생기부 진단 가이드');
    clickTab('부족 활동 보완안');
    expect(window.history.length).toBe(before);
  });

  it('다른 쿼리 파라미터는 보존한다', async () => {
    setUrl('/result?from=palette');
    render(<ResultPage />);
    clickTab('생기부 진단 가이드');
    expect(window.location.search).toContain('from=palette');
    expect(window.location.search).toContain('tab=diagnosis');
  });
});

describe('?tab= 딥링크 — 회귀 가드', () => {
  // 【핵심】 URL→탭 effect 의 의존성 배열이 없는 이유를 고정한다.
  // /result 에 이미 있는 상태에서 ⌘K 팔레트가 router.push('/result?tab=…') 하면 Next 는
  // 같은 컴포넌트를 remount 하지 않고 **다시 렌더만** 한다. RTL 의 rerender() 가 그 상황이다.
  // effect 에 `[]` 를 넣으면 이 테스트가 깨진다 — 그게 이 테스트의 존재 이유다.
  it('remount 없이 URL 만 바뀌어도 탭이 따라온다 (팔레트로 탭 이동)', async () => {
    const { rerender } = render(<ResultPage />);
    expect(selectedTab()).toBe('학생부 종합 전형 면접 준비 팩');

    // 팔레트의 router.push 가 하는 일 그대로: 주소 변경 + 같은 트리 재렌더(언마운트 아님).
    window.history.pushState(null, '', '/result?tab=diagnosis');
    rerender(<ResultPage />);

    await waitFor(() => expect(selectedTab()).toBe('생기부 진단 가이드'));
    // remount 가 아니었음을 증명한다 — 마운트 1회 effect([] 의존성)가 다시 돌지 않았다.
    // 즉 위 동작은 "다시 마운트돼서" 된 게 아니라 의존성 없는 effect 덕분이다.
    expect(loadSubmittedProfile).toHaveBeenCalledTimes(1);
  });

  // 【핵심】 유효 탭 → 파라미터 없음/무효 값 **전이**. (Codex PR #74 P1)
  // 진입 시점(?tab=nope → 기본 탭)만 고정하면 이 경로를 놓친다. 팔레트 인덱스의
  // "진단 결과" href 가 파라미터 없는 `/result` 라, ?tab=diagnosis 를 보던 사용자가 ⌘K 로
  // 그걸 고르면 remount 없이 URL 만 `/result` 가 된다 — 주소는 기본 탭인데 화면은 진단 탭이면
  // 어긋난다. effect 가 `fromUrl ?? DEFAULT_TAB` 이 아니라 `if (fromUrl)` 이면 여기서 깨진다.
  it('?tab=diagnosis → /result(파라미터 없음): remount 없이 기본 탭으로 되돌아온다', async () => {
    setUrl('/result?tab=diagnosis');
    const { rerender } = render(<ResultPage />);
    await waitFor(() => expect(selectedTab()).toBe('생기부 진단 가이드'));

    window.history.pushState(null, '', '/result');
    rerender(<ResultPage />);

    await waitFor(() => expect(selectedTab()).toBe('학생부 종합 전형 면접 준비 팩'));
    expect(loadSubmittedProfile).toHaveBeenCalledTimes(1); // remount 가 아니었다
  });

  it('?tab=diagnosis → ?tab=nope: remount 없이 기본 탭으로 되돌아온다', async () => {
    setUrl('/result?tab=diagnosis');
    const { rerender } = render(<ResultPage />);
    await waitFor(() => expect(selectedTab()).toBe('생기부 진단 가이드'));

    window.history.pushState(null, '', '/result?tab=nope');
    rerender(<ResultPage />);

    await waitFor(() => expect(selectedTab()).toBe('학생부 종합 전형 면접 준비 팩'));
    expect(loadSubmittedProfile).toHaveBeenCalledTimes(1); // remount 가 아니었다
  });

  // 【핵심】 syncedSearchRef 가드를 고정한다.
  // history API 는 브라우저가 호출 빈도를 제한해 실제로 실패할 수 있다(Safari SecurityError).
  // effect 가 URL 의 "값"에 반응하면, 주소가 옛 탭에 멈춘 상태에서 다음 렌더가 방금 누른 탭을
  // 되감아 버린다. 가드를 지우면 이 테스트가 깨진다.
  it('주소 갱신이 실패해도 방금 누른 탭이 되감기지 않는다', async () => {
    setUrl('/result?tab=diagnosis');
    const replaceState = vi
      .spyOn(window.history, 'replaceState')
      .mockImplementation(() => {
        throw new Error('SecurityError: too many history calls');
      });
    try {
      const { rerender } = render(<ResultPage />);
      await waitFor(() => expect(selectedTab()).toBe('생기부 진단 가이드'));

      clickTab('부족 활동 보완안');
      expect(selectedTab()).toBe('부족 활동 보완안');
      // 주소는 갱신에 실패해 옛 탭(diagnosis)에 멈춰 있다.
      expect(window.location.search).toBe('?tab=diagnosis');

      // 이후 어떤 이유로든 다시 렌더돼도 선택은 사용자가 누른 탭 그대로다.
      rerender(<ResultPage />);
      expect(selectedTab()).toBe('부족 활동 보완안');
    } finally {
      replaceState.mockRestore();
    }
  });

  // 위 테스트의 사각지대. 기본 탭 폴백(`?? DEFAULT_TAB`)이 생기면서 "URL 에 tab 이 없다"가
  // 이제 **적극적으로 기본 탭을 뜻한다**. 그래서 파라미터 없는 /result 에서 탭을 눌렀는데
  // 주소 갱신까지 실패하면(주소엔 tab 없음 = 기본 탭, 화면은 방금 누른 탭) 되감길 여지가 생긴다.
  // syncedSearchRef 의 조기 return 이 그걸 막는지 별도로 확인한다.
  it('파라미터 없는 /result 에서 눌렀을 때 주소 갱신이 실패해도 기본 탭으로 되감기지 않는다', async () => {
    setUrl('/result');
    const replaceState = vi
      .spyOn(window.history, 'replaceState')
      .mockImplementation(() => {
        throw new Error('SecurityError: too many history calls');
      });
    try {
      const { rerender } = render(<ResultPage />);
      expect(selectedTab()).toBe('학생부 종합 전형 면접 준비 팩');

      clickTab('생기부 진단 가이드');
      expect(selectedTab()).toBe('생기부 진단 가이드');
      expect(window.location.search).toBe(''); // 주소는 갱신에 실패해 파라미터가 없다

      rerender(<ResultPage />);
      expect(selectedTab()).toBe('생기부 진단 가이드');
    } finally {
      replaceState.mockRestore();
    }
  });
});
