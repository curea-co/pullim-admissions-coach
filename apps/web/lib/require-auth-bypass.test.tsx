import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 개발용 게이트 우회(NEXT_PUBLIC_DEV_GATE_BYPASS)가 **인증 게이트에도** 배선됐는지 고정한다.
// 구매 벽 우회(①)만으로는 부족하다 — 토큰이 없으면 RequireAuth 가 먼저 OS 로그인/내부 /login 으로
// 보내 버려서 구매 벽 화면에 닿지도 못한다. 이 배선이 끊기면 dev 배포를 로그인 없이 여는 경로가
// 사라진다. 우회 헬퍼(lib/dev-bypass.ts)는 mock 하지 않는다 — 잠금이 컴포넌트 경로에서도 도는지 본다.

// useAuth 반환값은 **렌더마다 같은 객체**여야 한다(effect deps 에 refresh 가 들어 있다).
const auth = vi.hoisted(() => ({
  status: 'guest' as 'authed' | 'guest' | 'loading' | 'error',
  user: null,
  logout: vi.fn(),
  refresh: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/components/auth/auth-provider', () => ({ useAuth: () => auth }));

const replace = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/submit',
}));

import { RequireAuth } from '../components/auth/require-auth';

const assign = vi.fn();
const child = () => screen.queryByText('보호된 화면');

/** jsdom 의 location 은 hostname 을 바꿀 수 없어 통째로 교체한다(dev-bypass.test.ts 와 같은 패턴). */
function setHost(hostname: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { hostname, origin: `https://${hostname}`, href: `https://${hostname}/submit`, assign },
  });
}

const renderGate = () =>
  render(
    <RequireAuth>
      <p>보호된 화면</p>
    </RequireAuth>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  setHost('localhost');
  auth.status = 'guest';
});
afterEach(() => vi.unstubAllEnvs());

describe('RequireAuth — 개발용 게이트 우회 배선', () => {
  it('플래그 off + guest → 화면을 열지 않고 로그인으로 보낸다(기존 동작)', async () => {
    renderGate();
    // NEXT_PUBLIC_OS_URL 미설정 → SSO 대신 내부 /login 폴백.
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login?next=%2Fsubmit'));
    expect(child()).not.toBeInTheDocument();
  });

  it.each(['localhost', 'dev-admissions.pullim.ai'])(
    '플래그 on + %s + guest → 토큰 없이 children 렌더, 리다이렉트 없음',
    async (h) => {
      vi.stubEnv('NEXT_PUBLIC_DEV_GATE_BYPASS', 'true');
      setHost(h);
      renderGate();

      await waitFor(() => expect(child()).toBeInTheDocument());
      expect(replace).not.toHaveBeenCalled();
      expect(assign).not.toHaveBeenCalled();
    },
  );

  it('플래그 on + guest + 일시 오류(error) 도 화면을 연다 — 토큰이 없으면 어느 쪽으로든 떨어질 수 있다', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEV_GATE_BYPASS', 'true');
    auth.status = 'error';
    renderGate();

    await waitFor(() => expect(child()).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
  });

  it('운영 호스트에서는 플래그가 켜져 있어도 열리지 않고 로그인으로 보낸다 — 마지막 잠금', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEV_GATE_BYPASS', 'true');
    setHost('admissions.pullim.ai');
    renderGate();

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login?next=%2Fsubmit'));
    expect(child()).not.toBeInTheDocument();
  });
});
