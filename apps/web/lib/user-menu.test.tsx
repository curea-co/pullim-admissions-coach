import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UserMenu } from '../components/auth/user-menu';

// 프로필 메뉴(topbar 우측) 상태 전이 회귀 고정 — Codex #70 P2.
// 이 컴포넌트는 브라우저 이벤트(바깥 클릭·Esc·방향키)와 비동기 logout()/이용권 조회에
// 의존해 수동 확인만으로는 회귀를 잡기 어렵다. 열기/닫기 · 포커스 · 배지 · 로그아웃
// 성공·실패 분기를 전부 고정한다.

let authStatus: 'loading' | 'authed' | 'guest' | 'error' = 'authed';
const logout = vi.fn();
const hasAdmissionsAccess = vi.fn();
const assign = vi.fn();
let settingsHref: string | null = 'https://os.example.test/settings';

vi.mock('@/components/auth/auth-provider', () => ({
  useAuth: () => ({
    status: authStatus,
    user: { id: 'u1', displayName: '박준호', email: 'a@b.test', tier: 'free', package: 'home' },
    logout,
    refresh: vi.fn(),
  }),
}));

// 실 auth 모드로 고정 — mock 모드에서는 이용권 개념 자체가 없어 배지 분기를 못 탄다.
vi.mock('@/lib/auth', () => ({ isPullimAuth: true }));

vi.mock('@/lib/admissions-api', () => ({
  hasAdmissionsAccess: () => hasAdmissionsAccess(),
}));

vi.mock('@/lib/auth/os-login', () => ({
  osLoginHref: (ret: string) => `https://os.example.test/login?next=${ret}`,
  osSignupHref: () => null,
  osSettingsHref: () => settingsHref,
}));

const openMenu = () => fireEvent.click(screen.getByRole('button', { name: '프로필 메뉴 열기' }));
const trigger = () => screen.getByRole('button', { name: '프로필 메뉴 열기' });
const items = () => screen.getAllByRole('menuitem');

beforeEach(() => {
  vi.clearAllMocks();
  authStatus = 'authed';
  settingsHref = 'https://os.example.test/settings';
  hasAdmissionsAccess.mockResolvedValue(true);
  logout.mockResolvedValue(undefined);
  // jsdom 의 location.assign 은 "Not implemented" 를 던진다 — 호출만 관찰하도록 교체.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { origin: 'http://localhost', href: 'http://localhost/', assign },
  });
});

describe('UserMenu — 프로필 메뉴 상태 전이', () => {
  it('아바타 트리거: 이니셜 1글자 + 초기 aria-expanded=false, 로그아웃 버튼은 topbar 에 없다', () => {
    render(<UserMenu />);
    expect(trigger()).toHaveTextContent('박');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(trigger()).toHaveAttribute('aria-haspopup', 'menu');
    // OS 규격: 로그아웃은 드롭다운 안에만 — 닫힌 상태에서 노출되면 안 된다.
    expect(screen.queryByText('로그아웃')).not.toBeInTheDocument();
  });

  it('클릭으로 열면 aria-expanded=true + 항목이 순서대로 나오고 첫 항목에 포커스', async () => {
    render(<UserMenu />);
    openMenu();
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(items().map((i) => i.textContent)).toEqual(['마이페이지', '설정', '로그아웃']);
    await waitFor(() => expect(items()[0]).toHaveFocus());
  });

  it('OS URL 미설정이면 "설정" 항목을 통째로 숨긴다', async () => {
    settingsHref = null;
    render(<UserMenu />);
    openMenu();
    expect(items().map((i) => i.textContent)).toEqual(['마이페이지', '로그아웃']);
    // 열면서 시작된 이용권 조회가 테스트 종료 후 resolve 되며 act() 경고를 내지 않도록 정착시킨다.
    await waitFor(() => expect(screen.getByText('입시 이용권 보유')).toBeInTheDocument());
  });

  it('Esc → 닫히고 트리거로 포커스가 돌아온다', async () => {
    render(<UserMenu />);
    openMenu();
    await waitFor(() => expect(items()[0]).toHaveFocus());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('바깥 클릭 → 닫힌다', async () => {
    render(<UserMenu />);
    openMenu();
    await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('방향키: ArrowDown/ArrowUp 순환 · Home/End', async () => {
    render(<UserMenu />);
    openMenu();
    const menu = screen.getByRole('menu');
    await waitFor(() => expect(items()[0]).toHaveFocus());

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(items()[1]).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'End' });
    expect(items()[2]).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'ArrowDown' }); // 마지막 → 처음으로 순환
    expect(items()[0]).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'ArrowUp' }); // 처음 → 마지막으로 순환
    expect(items()[2]).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'Home' });
    expect(items()[0]).toHaveFocus();
  });

  it('닫힌 상태에서 트리거에 ArrowDown → 열린다', async () => {
    render(<UserMenu />);
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());
  });

  it('이용권 보유 → 플랜 배지 노출. 조회는 열 때 1회만', async () => {
    render(<UserMenu />);
    openMenu();
    await waitFor(() => expect(screen.getByText('입시 이용권 보유')).toBeInTheDocument());
    expect(hasAdmissionsAccess).toHaveBeenCalledTimes(1);
  });

  it('이용권 조회 실패 → 배지를 숨긴다(플랜을 단정하지 않음)', async () => {
    hasAdmissionsAccess.mockRejectedValue(new Error('network'));
    render(<UserMenu />);
    openMenu();
    await waitFor(() => expect(screen.getByText('로그인됨')).toBeInTheDocument());
    expect(screen.queryByText('입시 이용권 보유')).not.toBeInTheDocument();
    expect(screen.queryByText('이용권 미보유')).not.toBeInTheDocument();
  });

  it('로그아웃 성공 → 서버 로그아웃 후 로그인 화면으로 이동', async () => {
    render(<UserMenu />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: '로그아웃' }));
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith('https://os.example.test/login?next=http://localhost'),
    );
  });

  it('로그아웃 실패 → 이동하지 않고 메뉴에 오류를 띄운다', async () => {
    logout.mockRejectedValue(new Error('boom'));
    render(<UserMenu />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: '로그아웃' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('로그아웃하지 못했어요'));
    // 로그아웃된 줄 알고 자리를 뜨는 사고 방지 — 세션 종료가 확인되지 않으면 이동하지 않는다.
    expect(assign).not.toHaveBeenCalled();
  });

  it('guest → 로그인/가입 CTA. 프로필 트리거는 없다', () => {
    authStatus = 'guest';
    render(<UserMenu />);
    expect(screen.getByText('로그인')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '프로필 메뉴 열기' })).not.toBeInTheDocument();
  });
});
