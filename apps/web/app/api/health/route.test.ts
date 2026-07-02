import { describe, it, expect, afterEach, vi } from 'vitest';
import { GET } from './route';

// 헬스 구성 신호 계약 고정 — 진단 이전(ADR-058) 후 FE 는 자기 구성만 신호한다:
// 실 인증(authBackend)·admissions API 베이스·OS SSO 진입점. 비밀/원문 값 비노출(boolean/enum만).

afterEach(() => vi.unstubAllEnvs());

async function body() {
  return (await GET().json()) as {
    ok: boolean;
    env: string;
    ready: boolean;
    config: { authBackend: string; admissionsApiBase: boolean; osUrl: boolean };
  };
}

describe('GET /api/health', () => {
  it('비밀 값은 노출하지 않고 boolean/enum만', async () => {
    vi.stubEnv('NEXT_PUBLIC_PULLIM_API', 'http://api.pullim.local:3000');
    vi.stubEnv('NEXT_PUBLIC_OS_URL', 'http://pullim.local:3001');
    const b = await body();
    expect(b.ok).toBe(true);
    expect(typeof b.config.admissionsApiBase).toBe('boolean');
    expect(typeof b.config.osUrl).toBe('boolean');
    expect(JSON.stringify(b)).not.toContain('api.pullim.local'); // 원문 URL 비노출
  });

  it('비프로덕션은 구성과 무관하게 ready:true(로컬 편의)', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_AUTH_BACKEND', '');
    const b = await body();
    expect(b.ready).toBe(true);
  });

  it('프로덕션 + 실 인증·API 베이스·OS 완비 → ready:true', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_AUTH_BACKEND', 'pullim');
    vi.stubEnv('NEXT_PUBLIC_PULLIM_API', 'https://api.pullim.ai');
    vi.stubEnv('NEXT_PUBLIC_OS_URL', 'https://pullim.ai');
    const b = await body();
    expect(b.ready).toBe(true);
    expect(b.config.authBackend).toBe('pullim');
  });

  it.each([
    ['NEXT_PUBLIC_AUTH_BACKEND', ''],
    ['NEXT_PUBLIC_PULLIM_API', ''],
    ['NEXT_PUBLIC_OS_URL', ''],
  ])('프로덕션에서 %s 누락 → ready:false', async (key, val) => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_AUTH_BACKEND', 'pullim');
    vi.stubEnv('NEXT_PUBLIC_PULLIM_API', 'https://api.pullim.ai');
    vi.stubEnv('NEXT_PUBLIC_OS_URL', 'https://pullim.ai');
    vi.stubEnv(key, val);
    const b = await body();
    expect(b.ready).toBe(false);
  });
});
