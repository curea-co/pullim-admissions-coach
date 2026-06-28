import { describe, it, expect, afterEach, vi } from 'vitest';
import type { RateLimitRule } from './types';

const RULES: RateLimitRule[] = [{ windowSec: 60, max: 3 }];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function freshLimiter() {
  vi.resetModules();
  return (await import('./index')).rateLimiter;
}

describe('rateLimiter (싱글톤 지연 init)', () => {
  it('개발/테스트(NODE_ENV!=production)는 memory로 바로 동작', async () => {
    const rl = await freshLimiter();
    expect((await rl.check('ip', RULES)).allowed).toBe(true);
  });

  it('프로덕션 + 백엔드 미설정 → fail-closed(throw)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const rl = await freshLimiter();
    await expect(rl.check('ip', RULES)).rejects.toThrow();
  });

  it('초기화 실패를 캐시하지 않고 다음 호출에서 재시도(영구 500 방지)', async () => {
    vi.stubEnv('NODE_ENV', 'production'); // 백엔드 미설정 → 첫 init 실패
    const rl = await freshLimiter();
    await expect(rl.check('ip', RULES)).rejects.toThrow();
    // 구성을 고치면 다음 호출은 성공해야 한다 — rejected promise가 캐시됐다면 계속 실패할 것.
    vi.stubEnv('RATE_LIMIT_BACKEND', 'memory');
    const res = await rl.check('ip2', RULES);
    expect(res.allowed).toBe(true);
  });
});
