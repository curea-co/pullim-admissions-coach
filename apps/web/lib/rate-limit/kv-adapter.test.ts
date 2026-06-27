import { describe, it, expect } from 'vitest';
import { createKvRateLimiter, type RuleLimiterFactory } from './kv-adapter';
import type { RateLimitRule } from './types';

const RULES: RateLimitRule[] = [
  { windowSec: 60, max: 3 }, // 버스트
  { windowSec: 86_400, max: 10 }, // 일일
];

const NOW = 1_000_000_000;
const clock = () => NOW;

/** 규칙별 고정 응답을 주는 가짜 factory. resetMs는 reset 절대 시각(ms). */
function fakeFactory(
  byWindow: Record<number, { success: boolean; remaining: number; resetMs: number }>
): RuleLimiterFactory {
  return (rule) => ({
    async limit() {
      const r = byWindow[rule.windowSec];
      return { success: r.success, remaining: r.remaining, reset: r.resetMs };
    },
  });
}

describe('createKvRateLimiter (멀티룰 조합)', () => {
  it('모든 규칙 통과 → allowed, remaining은 가장 빡빡한 규칙 기준', async () => {
    const rl = createKvRateLimiter({
      now: clock,
      factory: fakeFactory({
        60: { success: true, remaining: 2, resetMs: NOW + 60_000 }, // 버스트(max3)
        86_400: { success: true, remaining: 8, resetMs: NOW + 86_400_000 }, // 일일(max10)
      }),
    });
    const res = await rl.check('ip', RULES);
    expect(res.allowed).toBe(true);
    expect(res.limit).toBe(3); // 가장 빡빡(min max)
    expect(res.remaining).toBe(2); // 버스트 remaining
  });

  it('한 규칙이라도 막히면 blocked + retryAfter(가장 늦게 풀리는 시각)', async () => {
    const rl = createKvRateLimiter({
      now: clock,
      factory: fakeFactory({
        60: { success: false, remaining: 0, resetMs: NOW + 30_000 }, // 30초 후 해제
        86_400: { success: true, remaining: 5, resetMs: NOW + 86_400_000 },
      }),
    });
    const res = await rl.check('ip', RULES);
    expect(res.allowed).toBe(false);
    expect(res.retryAfterSec).toBe(30); // ceil((reset-now)/1000)
    expect(res.remaining).toBe(0);
  });

  it('여러 규칙이 막히면 가장 늦은 retryAfter 채택', async () => {
    const rl = createKvRateLimiter({
      now: clock,
      factory: fakeFactory({
        60: { success: false, remaining: 0, resetMs: NOW + 20_000 },
        86_400: { success: false, remaining: 0, resetMs: NOW + 50_000 },
      }),
    });
    const res = await rl.check('ip', RULES);
    expect(res.allowed).toBe(false);
    expect(res.retryAfterSec).toBe(50); // max(20, 50)
  });

  it('retryAfter는 최소 1초(이미 지난 reset도)', async () => {
    const rl = createKvRateLimiter({
      now: clock,
      factory: fakeFactory({
        60: { success: false, remaining: 0, resetMs: NOW - 5_000 }, // 과거
        86_400: { success: true, remaining: 5, resetMs: NOW + 86_400_000 },
      }),
    });
    expect((await rl.check('ip', RULES)).retryAfterSec).toBe(1);
  });
});
