import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// 상세(/result/[id]) 의 브레드크럼 회귀 고정.
//
// 상세는 목록의 하위 화면인데, 처음에는 되돌아가는 길이 **본문 맨 아래 링크 하나뿐**이었다.
// 결과 본문이 길어서(면접 10문항 + 진단 + 보완) 목록으로 가려면 끝까지 스크롤해야 했다.
// 그래서 상단에 브레드크럼을 둔다. 이 테스트가 고정하는 것:
//   1) 목록으로 가는 링크가 **화면 위쪽**에 있다(`/result`).
//   2) 현재 항목은 링크가 아니라 aria-current="page" 다 — 자기 자신으로 가는 링크는 오해를 준다.
//   3) 현재 항목 라벨은 **목록이 그 줄을 부르는 이름과 같다**(생성일). id 나 다른 표기로 바꾸면
//      방금 누른 줄을 알아볼 수 없다 → 두 화면의 날짜 포맷이 갈라지면 여기서 깨진다.

vi.mock('@/components/auth/require-auth', () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/auth/require-admissions-access', () => ({
  RequireAdmissionsAccess: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/lib/admissions-api', () => ({
  getDiagnosis: vi.fn().mockResolvedValue({
    id: 'd1',
    status: 'done',
    createdAt: '2026-09-20T02:00:00.000Z',
  }),
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

import ResultDetailPage from './page';

beforeEach(() => vi.clearAllMocks());

const crumb = () => screen.getByRole('navigation', { name: '현재 위치' });

describe('/result/[id] — 브레드크럼', () => {
  it('목록으로 돌아가는 링크가 상단에 있다', async () => {
    render(<ResultDetailPage params={{ id: 'd1' }} />);
    const back = await screen.findByRole('link', { name: '진단 내역' });
    expect(back).toHaveAttribute('href', '/result');
    expect(crumb()).toContainElement(back);
  });

  it('현재 항목은 링크가 아니고 aria-current="page" 를 단다', async () => {
    render(<ResultDetailPage params={{ id: 'd1' }} />);
    const current = await screen.findByText(/2026년 9월 20일 진단/);
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current.closest('a')).toBeNull();
  });

  it('조회 전에는 날짜 대신 중립 라벨을 두고, 링크는 그때도 살아 있다', () => {
    render(<ResultDetailPage params={{ id: 'd1' }} />);
    // 첫 렌더(로딩) — 날짜를 모르는 동안 빈 칸이나 id 를 내보이지 않는다.
    expect(screen.getByRole('link', { name: '진단 내역' })).toHaveAttribute('href', '/result');
    expect(crumb()).toHaveTextContent('진단 결과');
  });
});
