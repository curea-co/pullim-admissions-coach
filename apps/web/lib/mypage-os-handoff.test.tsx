import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 마이페이지 하단 계정 조작이 **실 auth 모드에서 풀림 OS 설정으로 넘어가는지** 고정한다.
//
// 실 어댑터의 deleteAccount 는 /account/delete 의 즉시삭제/유예 정책이 아직
// TODO(pullim-api-adapter.ts:109)다. 내부 모달을 실 모드에서 그대로 쓰면 "탈퇴를 눌렀는데
// 실패" 가 되는데, 탈퇴는 되돌릴 수 없는 조작이라 그게 가장 나쁜 결과다. 그래서 실 모드에서는
// 모달 자체를 내보내지 않고 OS 설정으로 보낸다.
//
// 로그아웃은 실 모드에서도 어댑터가 동작하므로 **그대로 남아야** 한다 — 같이 사라지면
// 사용자가 이 화면에서 세션을 끊을 방법이 없어진다.

const flags = vi.hoisted(() => ({ isPullimAuth: true }));
const deleteAccount = vi.fn();
let settingsHref: string | null = 'https://os.example.test/settings';

vi.mock('@/lib/auth', () => ({
  auth: { deleteAccount: () => deleteAccount() },
  get isPullimAuth() {
    return flags.isPullimAuth;
  },
}));

vi.mock('@/lib/auth/os-login', () => ({
  osSettingsHref: () => settingsHref,
}));

// RequireAuth 는 이 테스트의 관심사가 아니다 — 게이트 통과 상태로 고정한다.
vi.mock('@/components/auth/require-auth', () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// useAuth 반환값은 렌더마다 같은 객체여야 한다 — refresh 가 effect deps 에 들어 있어
// 매 렌더 새 함수를 돌려주면 effect 가 무한 재실행된다(테스트가 조용히 루프로 죽는다).
const authState = vi.hoisted(() => ({
  status: 'authed' as const,
  user: {
    id: 'u1',
    displayName: '박준호',
    email: 'a@b.test',
    tier: 'free',
    package: 'home',
    ageBand: 'over14',
    isMinor: false,
  },
  logout: vi.fn().mockResolvedValue(undefined),
  refresh: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/components/auth/auth-provider', () => ({ useAuth: () => authState }));

vi.mock('@/lib/admissions-api', () => ({
  hasAdmissionsAccess: vi.fn().mockResolvedValue(true),
  clearAdmissionsAccessCache: vi.fn(),
}));

vi.mock('@/lib/result-store', () => ({ listDiagnoses: () => [] }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import MyPage from '../app/mypage/page';

const osLink = () => screen.queryByRole('link', { name: '계정 설정·탈퇴' });
const deleteButton = () => screen.queryByRole('button', { name: '회원탈퇴' });
const logoutButton = () => screen.queryByRole('button', { name: '로그아웃' });

beforeEach(() => {
  vi.clearAllMocks();
  flags.isPullimAuth = true;
  settingsHref = 'https://os.example.test/settings';
});

describe('마이페이지 — 실 auth 모드에서 계정 정본은 풀림 OS', () => {
  it('실 모드 + OS URL 설정: 내부 탈퇴 버튼 대신 OS 설정 링크를 내보낸다', async () => {
    render(<MyPage />);
    await waitFor(() => expect(osLink()).toBeInTheDocument());
    expect(osLink()).toHaveAttribute('href', 'https://os.example.test/settings');
    expect(deleteButton()).toBeNull();
  });

  it('탈퇴 모달로 가는 입구가 없으니 deleteAccount 는 호출될 길이 없다', async () => {
    render(<MyPage />);
    await waitFor(() => expect(osLink()).toBeInTheDocument());
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('로그아웃은 실 모드에서도 남는다 — 세션 끊을 방법까지 사라지면 안 된다', async () => {
    render(<MyPage />);
    await waitFor(() => expect(logoutButton()).toBeInTheDocument());
  });

  it('OS URL 미설정(null): 내부 탈퇴 버튼으로 폴백한다', async () => {
    settingsHref = null;
    render(<MyPage />);
    await waitFor(() => expect(deleteButton()).toBeInTheDocument());
    expect(osLink()).toBeNull();
  });

  it('mock auth 모드: OS 설정이 있어도 내부 탈퇴 버튼을 쓴다', async () => {
    flags.isPullimAuth = false;
    render(<MyPage />);
    await waitFor(() => expect(deleteButton()).toBeInTheDocument());
    expect(osLink()).toBeNull();
  });
});
