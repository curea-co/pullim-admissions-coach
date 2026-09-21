import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// /result 의 **게이트-조회 순서** 회귀 고정 (자체 리뷰, PR #98).
//
// 왜 이 파일이 있나 — 게이트(RequireAdmissionsAccess)는 JSX 렌더만 막고 마운트 effect 는 막지
// 못한다. 그래서 조회 effect 를 페이지 컴포넌트 **자신**에 두면 두 가지가 동시에 깨진다:
//   ① 미보유 사용자가 /result 로 deep-link 하면 GET /admissions/results 가 발사돼 403 을 받는다
//      (게이트를 붙인 이유가 바로 이걸 막으려던 것).
//   ② 그 403 은 state='unavailable' 로 굳는데, 쿠폰 등록·"다시 확인"·개발 우회로 **벽이 그 자리에서
//      걷혀도** 페이지는 remount 되지 않아 조회가 다시 돌지 않는다 → 이용권을 산 사용자가 실제
//      결과 대신 "결과를 불러오지 못했어요" 를 계속 본다(새로고침해야 풀림).
// 해결은 /processing 과 같다: 조회를 게이트 **하위 자식**(ResultView)으로 내린다.
// 아래 두 테스트는 그 구조를 고정한다 — effect 를 페이지로 되올리면 둘 다 깨진다.

const fetchLatestDiagnosis = vi.hoisted(() => vi.fn());
// 게이트의 실제 동작을 모사한다: 통과 전에는 children 을 **렌더하지 않는다**(벽을 대신 그린다).
const gate = vi.hoisted(() => ({ allowed: false }));

vi.mock('@/components/auth/require-auth', () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/auth/require-admissions-access', () => ({
  RequireAdmissionsAccess: ({ children }: { children: React.ReactNode }) =>
    gate.allowed ? <>{children}</> : <div>유료 회원만 이용할 수 있어요</div>,
}));

vi.mock('@/lib/admissions-api', () => ({
  fetchLatestDiagnosis,
  loadLastResultId: vi.fn().mockReturnValue(null),
  saveLastResultId: vi.fn(),
  getDiagnosis: vi.fn(),
  toAnalyzeResult: vi.fn().mockReturnValue({ diagnosis: {}, rubric: {} }),
}));
vi.mock('@/lib/result-view', () => ({
  toResultViewModel: vi.fn().mockReturnValue({
    interview: [],
    diagnosis: [],
    keywords: [],
    improvements: [],
  }),
}));
vi.mock('@/lib/submitted-profile', () => ({
  loadSubmittedProfile: vi.fn().mockReturnValue(null),
}));

import ResultPage from '../app/result/page';

beforeEach(() => {
  vi.clearAllMocks();
  gate.allowed = false;
  fetchLatestDiagnosis.mockResolvedValue({ id: 'd1', status: 'done' });
});

describe('/result — 이용권 게이트와 결과 조회의 순서', () => {
  it('벽에 막혀 있는 동안에는 진단 조회 API 를 쏘지 않는다', async () => {
    render(<ResultPage />);

    expect(screen.getByText(/유료 회원만 이용할 수 있어요/)).toBeInTheDocument();
    // effect 가 페이지에 있으면 여기서 이미 호출돼 있다(= 미보유 deep-link 의 403).
    await waitFor(() => expect(fetchLatestDiagnosis).not.toHaveBeenCalled());
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('벽이 그 자리에서 걷히면(쿠폰 등록·재확인) 그때 조회가 돌아 실제 결과가 뜬다', async () => {
    const { rerender } = render(<ResultPage />);
    expect(fetchLatestDiagnosis).not.toHaveBeenCalled();

    // 쿠폰 등록·"다시 확인"·개발 우회가 하는 일: 언마운트 없이 게이트만 통과로 바뀐다.
    gate.allowed = true;
    rerender(<ResultPage />);

    await waitFor(() => expect(fetchLatestDiagnosis).toHaveBeenCalledTimes(1));
    // 조회가 다시 돌지 않으면 여기서 탭 대신 오류 배너가 남는다.
    expect(await screen.findByRole('tablist')).toBeInTheDocument();
    expect(screen.queryByText(/결과를 불러오지 못했어요/)).toBeNull();
  });
});
