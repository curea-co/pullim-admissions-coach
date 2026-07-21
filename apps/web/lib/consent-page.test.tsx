import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ConsentPage from '../app/consent/page';

// 화면에서 노출되는 미성년 권위값(user.isMinor) 분기 회귀 고정(#52·#65).
// 순수 게이트 로직은 lib/consent-gate.test 에서, 여기서는 렌더 결과(성인=보호자 생략 가능,
// 미성년=보호자 필수)만 확인한다. mock 은 파일 단위 hoist 되므로 currentUser 를 케이스별로 교체.
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

describe('ConsentPage — 미성년 권위값 분기', () => {
  beforeEach(() => {
    currentUser = { id: 'u1' };
  });

  it('성인(isMinor:false)이면 보호자 항목은 생략 가능으로 보인다', () => {
    currentUser = { id: 'u1', isMinor: false };
    render(<ConsentPage />);

    expect(screen.getByText('성인')).toBeInTheDocument();
    expect(screen.getByText('생략 가능')).toBeInTheDocument();
  });

  it('미성년(isMinor:true)이면 보호자 동의가 필수로 보인다', () => {
    currentUser = { id: 'u1', isMinor: true };
    render(<ConsentPage />);

    expect(screen.getByText('미성년')).toBeInTheDocument();
    expect(screen.queryByText('생략 가능')).not.toBeInTheDocument();
  });
});
