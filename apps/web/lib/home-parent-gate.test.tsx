import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import LandingPage from '../app/page';
import ParentReportPage from '../app/parent/page';

// §7-1 게스트는 어떤 화면에도 진입 불가 — 홈(소개)·학부모 리포트의 로그인 벽 회귀 고정.
// 레이아웃/인증 리팩터링으로 RequireAuth 가 빠져 게스트가 다시 진입해도 CI 가 잡도록 한다.
let authStatus: 'guest' | 'authed' = 'guest';
const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/',
}));

vi.mock('@/components/auth/auth-provider', () => ({
  useAuth: () => ({ status: authStatus, refresh: vi.fn(), user: { id: 'u1' } }),
}));

// SSO 미설정 환경(테스트)에서 게스트는 내부 /login 으로 리다이렉트되도록 강제.
vi.mock('@/lib/auth/os-login', () => ({
  osLoginHref: () => null,
  osSignupHref: () => null,
}));

// 학부모 페이지 본문 마운트 시의 요약 조회를 무력화(게스트에서도 컴포넌트 본체 훅은 실행됨).
vi.mock('@/lib/admissions-api', () => ({
  getParentSummary: () => Promise.resolve(null),
}));

describe('§7-1 게스트 로그인 벽 — 홈/학부모', () => {
  beforeEach(() => {
    replace.mockClear();
  });

  it('홈(/): 게스트는 본문을 볼 수 없고 로그인으로 리다이렉트된다', () => {
    authStatus = 'guest';
    render(<LandingPage />);
    expect(screen.queryByText(/면접 준비 팩/)).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith(expect.stringContaining('/login?next='));
  });

  it('홈(/): 로그인 회원은 본문을 볼 수 있다', () => {
    authStatus = 'authed';
    render(<LandingPage />);
    expect(screen.getByText(/면접 준비 팩/)).toBeInTheDocument();
  });

  it('학부모(/parent): 게스트는 본문을 볼 수 없고 로그인으로 리다이렉트된다', () => {
    authStatus = 'guest';
    render(<ParentReportPage />);
    expect(screen.queryByText('자녀 진행 요약')).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith(expect.stringContaining('/login?next='));
  });

  it('학부모(/parent): 로그인 회원은 본문(진행 요약)을 볼 수 있다', () => {
    authStatus = 'authed';
    render(<ParentReportPage />);
    expect(screen.getByText('자녀 진행 요약')).toBeInTheDocument();
  });
});
