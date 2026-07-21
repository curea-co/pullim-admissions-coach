import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ConsentPage from '../app/consent/page';

// 미성년 권위값(user.isMinor) 기반 동의 게이트의 보안 경계 회귀 고정(#52·#65).
// 핵심: (1) 미성년은 보호자 동의 없이 진행 불가, (2) user.isMinor 가 undefined 면
// fail-closed 로 미성년 처리(성인 기본값으로 되돌아가지 않게), (3) 성인은 보호자 동의 면제.
let currentUser: { id: string; isMinor?: boolean } = { id: 'u1' };

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/components/auth/auth-provider', () => ({
  useAuth: () => ({ user: currentUser }),
}));

vi.mock('@/components/auth/require-auth', () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/auth/require-admissions-access', () => ({
  RequireAdmissionsAccess: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function checkbox(name: RegExp) {
  return screen.getByRole('checkbox', { name });
}
function proceedBtn() {
  return screen.getByRole('button', { name: /동의 후 진단 시작/ });
}

describe('ConsentPage — 미성년 권위값 동의 게이트', () => {
  beforeEach(() => {
    currentUser = { id: 'u1' };
  });

  it('성인(isMinor:false): 보호자 동의는 생략 가능, 약관+개인정보만으로 진행 가능', () => {
    currentUser = { id: 'u1', isMinor: false };
    render(<ConsentPage />);

    expect(screen.getByText('성인')).toBeInTheDocument();
    expect(screen.getByText('생략 가능')).toBeInTheDocument();
    expect(proceedBtn()).toHaveAttribute('aria-disabled', 'true'); // 초기: 미체크

    fireEvent.click(checkbox(/서비스 이용약관 동의/));
    fireEvent.click(checkbox(/개인정보 수집·이용 동의/));

    // 성인은 보호자 동의 없이도 진행 가능
    expect(proceedBtn()).toHaveAttribute('aria-disabled', 'false');
  });

  it('미성년(isMinor:true): 보호자 동의 없이는 진행 불가, 동의하면 진행 가능', () => {
    currentUser = { id: 'u1', isMinor: true };
    render(<ConsentPage />);

    expect(screen.getByText('미성년')).toBeInTheDocument();
    expect(screen.queryByText('생략 가능')).not.toBeInTheDocument();

    fireEvent.click(checkbox(/서비스 이용약관 동의/));
    fireEvent.click(checkbox(/개인정보 수집·이용 동의/));
    // 보호자 동의 전 — 여전히 차단
    expect(proceedBtn()).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(checkbox(/미성년자 — 법정대리인 동의/));
    expect(proceedBtn()).toHaveAttribute('aria-disabled', 'false');
  });

  it('isMinor undefined: fail-closed 로 미성년 처리 — 보호자 동의 없이 진행 불가', () => {
    currentUser = { id: 'u1' }; // isMinor 미확정
    render(<ConsentPage />);

    // 성인 기본값으로 새지 않고 미성년으로 고정
    expect(screen.getByText('미성년')).toBeInTheDocument();

    fireEvent.click(checkbox(/서비스 이용약관 동의/));
    fireEvent.click(checkbox(/개인정보 수집·이용 동의/));
    // 미확정을 성인으로 취급했다면 여기서 진행 가능해지지만, fail-closed 라 차단되어야 한다
    expect(proceedBtn()).toHaveAttribute('aria-disabled', 'true');
  });

  // §6 보관 기간 법적 고지 — 정책 준수 카피가 예전 값(30일)으로 회귀하지 않도록 고정.
  it('개인정보 동의에 보관 기간 "동의 시점부터 12개월" 고지가 노출된다', () => {
    currentUser = { id: 'u1', isMinor: false };
    render(<ConsentPage />);
    expect(screen.getByText(/동의 시점부터 12개월/)).toBeInTheDocument();
    expect(screen.queryByText(/보관 기간 30일/)).not.toBeInTheDocument();
  });
});
