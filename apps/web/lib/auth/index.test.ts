import { describe, it, expect, vi, afterEach } from 'vitest';

// auth 어댑터 선택은 모듈 로드 시 env로 결정되므로, env를 stub하고 resetModules 후
// 동적 import로 매번 새로 평가한다.
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadAuth() {
  vi.resetModules();
  const [{ auth }, { pullimApiAuthAdapter }, { mockAuthAdapter }] = await Promise.all([
    import('./index'),
    import('./pullim-api-adapter'),
    import('./mock-adapter'),
  ]);
  return { auth, pullimApiAuthAdapter, mockAuthAdapter };
}

describe('auth 어댑터 선택 (명시 옵트인)', () => {
  it('NEXT_PUBLIC_AUTH_BACKEND=pullim → 실 어댑터', async () => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_BACKEND', 'pullim');
    const { auth, pullimApiAuthAdapter } = await loadAuth();
    expect(auth).toBe(pullimApiAuthAdapter);
  });

  it('플래그 없으면 mock (URL만 있어도 전환 안 됨)', async () => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_BACKEND', '');
    vi.stubEnv('NEXT_PUBLIC_PULLIM_API', 'http://localhost:3000');
    const { auth, mockAuthAdapter } = await loadAuth();
    expect(auth).toBe(mockAuthAdapter);
  });

  it('플래그가 다른 값이면 mock', async () => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_BACKEND', 'pullim-staging');
    const { auth, mockAuthAdapter } = await loadAuth();
    expect(auth).toBe(mockAuthAdapter);
  });
});
