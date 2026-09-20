import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 개발용 엔타이틀먼트 우회가 **게이트 컴포넌트에 실제로 배선됐는지** 고정한다.
// dev 의 /me/entitlements 에는 admissions 자리가 없어 실 auth 모드에서는 항상 denied 이므로,
// 이 배선이 끊기면 /submit·/consent·/processing 을 실 auth 로 볼 방법이 다시 사라진다.
// 우회 헬퍼(lib/dev-bypass.ts)는 mock 하지 않는다 — 이중 잠금이 컴포넌트 경로에서도 도는지 본다.

const hasAdmissionsAccess = vi.fn();
const clearAdmissionsAccessCache = vi.fn();

// useAuth 반환값은 **렌더마다 같은 객체**여야 한다 — 게이트 effect 의 deps 에 refresh 가 들어 있어
// 매 렌더 새 함수를 돌려주면 effect 가 무한 재실행된다(테스트가 조용히 루프로 죽는다).
const auth = vi.hoisted(() => ({
  // 게이트 우회(②) 케이스가 'guest' 로 갈아끼우므로 리터럴로 굳히지 않는다(beforeEach 에서 복원).
  status: 'authed' as 'authed' | 'guest',
  user: { id: 'u1', displayName: '박준호', email: 'a@b.test', tier: 'free', package: 'home' },
  logout: vi.fn(),
  refresh: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/components/auth/auth-provider', () => ({ useAuth: () => auth }));

// 실 auth 모드로 고정 — mock 모드에는 구매 벽 개념 자체가 없어 게이트가 무조건 통과한다.
vi.mock('@/lib/auth', () => ({ isPullimAuth: true }));

vi.mock('@/lib/admissions-api', () => ({
  hasAdmissionsAccess: () => hasAdmissionsAccess(),
  clearAdmissionsAccessCache: () => clearAdmissionsAccessCache(),
}));

import { RequireAdmissionsAccess } from '../components/auth/require-admissions-access';

const KEY = 'admissions-dev-entitlement-bypass';
const devButton = () => screen.queryByRole('button', { name: '개발용으로 화면만 열기' });
const child = () => screen.queryByText('보호된 화면');

function setHost(hostname: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { hostname, origin: `https://${hostname}`, href: `https://${hostname}/` },
  });
}

const renderGate = () =>
  render(
    <RequireAdmissionsAccess>
      <p>보호된 화면</p>
    </RequireAdmissionsAccess>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  setHost('localhost');
  auth.status = 'authed';
  hasAdmissionsAccess.mockResolvedValue(false); // 미보유 = dev 의 실제 상태(admissions 키 없음)
});
afterEach(() => vi.unstubAllEnvs());

describe('RequireAdmissionsAccess — 개발용 엔타이틀먼트 우회 배선', () => {
  it('denied + 플래그 off → 구매 벽만 나오고 개발 버튼은 없다', async () => {
    renderGate();
    await screen.findByText('유료 회원만 이용할 수 있어요');
    expect(devButton()).not.toBeInTheDocument();
    expect(child()).not.toBeInTheDocument();
  });

  it('denied + 플래그 on(로컬) → 개발 버튼 노출, 클릭하면 children + 경고 배지', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEV_ENTITLEMENT_BYPASS', 'true');
    renderGate();
    await screen.findByText('유료 회원만 이용할 수 있어요');
    // 실 권한처럼 보이지 않도록 한계를 명시한 안내가 버튼과 함께 붙어 있어야 한다.
    expect(screen.getByText('개발 환경 전용')).toBeInTheDocument();

    fireEvent.click(devButton()!);

    await waitFor(() => expect(child()).toBeInTheDocument());
    expect(screen.getByText('개발 우회 중 · 실 이용권 아님')).toBeInTheDocument();
    expect(window.sessionStorage.getItem(KEY)).toBe('1');
  });

  it('운영 호스트에서는 플래그가 켜져 있어도 개발 버튼이 없다', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEV_ENTITLEMENT_BYPASS', 'true');
    setHost('admissions.pullim.ai');
    renderGate();
    await screen.findByText('유료 회원만 이용할 수 있어요');
    expect(devButton()).not.toBeInTheDocument();
  });

  it('우회가 켜진 채 마운트되면 hasAdmissionsAccess 를 호출하지 않는다', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEV_ENTITLEMENT_BYPASS', 'true');
    window.sessionStorage.setItem(KEY, '1');
    renderGate();
    await waitFor(() => expect(child()).toBeInTheDocument());
    expect(screen.getByText('개발 우회 중 · 실 이용권 아님')).toBeInTheDocument();
    expect(hasAdmissionsAccess).not.toHaveBeenCalled();
  });

  it('배지의 해제를 누르면 저장값이 지워지고 다시 구매 벽으로 돌아온다', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEV_ENTITLEMENT_BYPASS', 'true');
    window.sessionStorage.setItem(KEY, '1');
    renderGate();
    await waitFor(() => expect(child()).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '해제' }));

    await screen.findByText('유료 회원만 이용할 수 있어요');
    expect(child()).not.toBeInTheDocument();
    expect(screen.queryByText('개발 우회 중 · 실 이용권 아님')).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
    // 해제 후에는 원래 경로(권위 신호 재조회)로 복귀해야 한다.
    expect(hasAdmissionsAccess).toHaveBeenCalledTimes(1);
    expect(clearAdmissionsAccessCache).toHaveBeenCalled();
  });
});

// ② 게이트 전체 우회 — 토큰 없이(status='guest') 화면이 열려야 한다.
// 이 배선이 끊기면 status 검사(`status !== 'authed'` → null)에 걸려 흰 화면이 되므로,
// dev 배포를 로그인 없이 확인하는 경로가 조용히 사라진다.
describe('RequireAdmissionsAccess — 개발용 게이트 우회(미인증 통과)', () => {
  it('플래그 on(로컬) + guest → 엔타이틀먼트 조회 없이 children + 게이트 우회 배지', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEV_GATE_BYPASS', 'true');
    auth.status = 'guest';
    renderGate();

    await waitFor(() => expect(child()).toBeInTheDocument());
    expect(screen.getByText('개발 게이트 우회 중 · 인증·이용권 검사 꺼짐')).toBeInTheDocument();
    expect(hasAdmissionsAccess).not.toHaveBeenCalled();
    // 빌드 플래그라 화면에서 끌 수 없다 — 아무 일도 안 하는 해제 버튼을 두지 않는다.
    expect(screen.queryByRole('button', { name: '해제' })).not.toBeInTheDocument();
  });

  it('운영 호스트에서는 플래그가 켜져 있어도 guest 를 통과시키지 않는다', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEV_GATE_BYPASS', 'true');
    setHost('admissions.pullim.ai');
    auth.status = 'guest';
    renderGate();

    await waitFor(() => expect(hasAdmissionsAccess).not.toHaveBeenCalled());
    expect(child()).not.toBeInTheDocument();
    expect(screen.queryByText('개발 게이트 우회 중 · 인증·이용권 검사 꺼짐')).not.toBeInTheDocument();
  });

  it('플래그 off + guest → 아무것도 렌더하지 않는다(기존 동작 유지)', async () => {
    auth.status = 'guest';
    renderGate();

    await waitFor(() => expect(hasAdmissionsAccess).not.toHaveBeenCalled());
    expect(child()).not.toBeInTheDocument();
  });
});
