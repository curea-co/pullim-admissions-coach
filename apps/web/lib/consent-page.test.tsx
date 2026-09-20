import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ConsentPage from '../app/consent/page';

// 연령 권위값(user.ageBand, 만14 경계) 기반 동의 게이트의 보안 경계 회귀 고정(#52·#65).
// 핵심: (1) 만14 미만은 보호자 동의 없이 진행 불가, (2) ageBand 가 미확정이면 fail-closed
// 로 '필요' 처리(면제 기본값으로 새지 않게), (3) 만14 이상은 본인 동의로 진행.
//
// 2026-09-20: 축이 만19(isMinor) → 만14(ageBand)로 정정됐다(경위는 lib/consent-gate.ts).
// 주 사용자인 고1~고3(만 16~18)이 over14 로 통과하는지가 이 파일의 핵심 회귀다.
let currentUser: { id: string; ageBand?: 'under14' | 'over14' | 'unknown' } = { id: 'u1' };

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

describe('ConsentPage — 연령 권위값(만14) 동의 게이트', () => {
  beforeEach(() => {
    currentUser = { id: 'u1' };
  });

  it('만14 이상(고1~고3): 보호자 동의는 생략 가능, 약관+개인정보만으로 진행 가능', () => {
    currentUser = { id: 'u1', ageBand: 'over14' };
    render(<ConsentPage />);

    expect(screen.getByText('만 14세 이상')).toBeInTheDocument();
    expect(screen.getByText('생략 가능')).toBeInTheDocument();
    expect(proceedBtn()).toHaveAttribute('aria-disabled', 'true'); // 초기: 미체크

    fireEvent.click(checkbox(/서비스 이용약관 동의/));
    fireEvent.click(checkbox(/개인정보 수집·이용 동의/));

    // 만14 이상은 보호자 동의 없이도 진행 가능 — 만19 축으로 되돌아가면 여기서 걸린다
    expect(proceedBtn()).toHaveAttribute('aria-disabled', 'false');
  });

  it('만14 미만: 보호자 동의 없이는 진행 불가, 동의하면 진행 가능', () => {
    currentUser = { id: 'u1', ageBand: 'under14' };
    render(<ConsentPage />);

    expect(screen.getByText('만 14세 미만')).toBeInTheDocument();
    expect(screen.queryByText('생략 가능')).not.toBeInTheDocument();

    fireEvent.click(checkbox(/서비스 이용약관 동의/));
    fireEvent.click(checkbox(/개인정보 수집·이용 동의/));
    // 보호자 동의 전 — 여전히 차단
    expect(proceedBtn()).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(checkbox(/만 14세 미만 — 법정대리인 동의/));
    expect(proceedBtn()).toHaveAttribute('aria-disabled', 'false');
  });

  it('ageBand 미확정: fail-closed — 보호자 동의 없이 진행 불가', () => {
    currentUser = { id: 'u1' }; // ageBand 미확정
    render(<ConsentPage />);

    // 면제 기본값으로 새지 않고 '필요'로 고정
    expect(screen.getByText('만 14세 미만')).toBeInTheDocument();

    fireEvent.click(checkbox(/서비스 이용약관 동의/));
    fireEvent.click(checkbox(/개인정보 수집·이용 동의/));
    // 미확정을 면제로 취급했다면 여기서 진행 가능해지지만, fail-closed 라 차단되어야 한다
    expect(proceedBtn()).toHaveAttribute('aria-disabled', 'true');
  });
});
