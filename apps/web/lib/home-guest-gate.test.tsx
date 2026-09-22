import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import LandingPage from '../app/page';

// §7-1 게스트는 어떤 화면에도 진입 불가 — 홈(소개)의 로그인 벽 회귀 고정.
// 레이아웃/인증 리팩터링으로 RequireAuth 가 빠져 게스트가 다시 진입해도 CI 가 잡도록 한다.
// (학부모 리포트(/parent)는 2026-09-21 제거 — 하드코딩 데모였고 실체인 주간 이메일 발송은
//  Phase E 미착수다. 그 화면의 로그인 벽 케이스도 함께 내렸다.)
let authStatus: 'guest' | 'authed' = 'guest';
const currentPath = '/';
const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => currentPath,
}));

vi.mock('@/components/auth/auth-provider', () => ({
  useAuth: () => ({ status: authStatus, refresh: vi.fn(), user: { id: 'u1' } }),
}));

// SSO 미설정 환경(테스트)에서 게스트는 내부 /login 으로 리다이렉트되도록 강제.
vi.mock('@/lib/auth/os-login', () => ({
  osLoginHref: () => null,
  osSignupHref: () => null,
}));

describe('§7-1 게스트 로그인 벽 — 홈', () => {
  beforeEach(() => {
    replace.mockClear();
  });

  it('홈(/): 게스트는 본문을 볼 수 없고 next=/ 를 보존해 로그인으로 리다이렉트된다', () => {
    authStatus = 'guest';
    render(<LandingPage />);
    expect(screen.queryByText(/면접 준비 팩/)).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith('/login?next=%2F');
  });

  it('홈(/): 로그인 회원은 본문을 볼 수 있다', () => {
    authStatus = 'authed';
    render(<LandingPage />);
    expect(screen.getByText(/면접 준비 팩/)).toBeInTheDocument();
  });
});
