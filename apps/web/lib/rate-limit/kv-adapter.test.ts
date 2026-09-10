import { describe, it, expect } from 'vitest';
import { createKvRateLimiter, type RuleLimiterFactory } from './kv-adapter';
import type { RateLimitRule } from './types';

const RULES: RateLimitRule[] = [
  { windowSec: 60, max: 3 }, // 버스트(먼저)
  { windowSec: 86_400, max: 10 }, // 일일
];

const NOW = 1_000_000_000;
const clock = () => NOW;

type RuleResp = { success: boolean; remaining: number; resetMs: number };

/** 규칙별 고정 응답 + 호출 횟수 기록(단락 검증용). */
function fakeFactory(byWindow: Record<number, RuleResp>) {
  const calls: Record<number, number> = {};
  const factory: RuleLimiterFactory = (rule) => ({
    async limit() {
      calls[rule.windowSec] = (calls[rule.windowSec] ?? 0) + 1;
      const r = byWindow[rule.windowSec];
      return { success: r.success, remaining: r.remaining, reset: r.resetMs };
    },
  });
  return { factory, calls };
}

describe('createKvRateLimiter (멀티룰 조합 · 계약 일치)', () => {
  it('모든 규칙 통과 → allowed, remaining은 가장 적게 남은(binding) 규칙', async () => {
    const { factory } = fakeFactory({
      60: { success: true, remaining: 2, resetMs: NOW + 60_000 }, // 버스트 2 남음
      86_400: { success: true, remaining: 1, resetMs: NOW + 86_400_000 }, // 일일 1 남음(binding)
    });
    const res = await createKvRateLimiter({ now: clock, factory }).check('ip', RULES);
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(1); // min(2,1) — 일일이 binding
    expect(res.limit).toBe(10); // binding 규칙(일일)의 max
  });

  it('첫 규칙(버스트)에서 막히면 단락 — 이후 규칙(일일) quota를 차감하지 않음', async () => {
    const { factory, calls } = fakeFactory({
      60: { success: false, remaining: 0, resetMs: NOW + 30_000 }, // 버스트 차단
      86_400: { success: true, remaining: 5, resetMs: NOW + 86_400_000 },
    });
    const res = await createKvRateLimiter({ now: clock, factory }).check('ip', RULES);
    expect(res.allowed).toBe(false);
    expect(res.retryAfterSec).toBe(30); // 버스트 reset 기준
    expect(calls[60]).toBe(1); // 버스트만 호출
    expect(calls[86_400]).toBeUndefined(); // 일일은 **호출 안 됨**(단락 → quota 미차감)
  });

  it('버스트 통과·일일 차단 → blocked(일일 reset 기준)', async () => {
    const { factory, calls } = fakeFactory({
      60: { success: true, remaining: 2, resetMs: NOW + 60_000 },
      86_400: { success: false, remaining: 0, resetMs: NOW + 50_000 },
    });
    const res = await createKvRateLimiter({ now: clock, factory }).check('ip', RULES);
    expect(res.allowed).toBe(false);
    expect(res.retryAfterSec).toBe(50);
    expect(calls[60]).toBe(1); // 버스트는 통과하며 호출됨
    expect(calls[86_400]).toBe(1);
  });

  it('retryAfter는 최소 1초(이미 지난 reset도)', async () => {
    const { factory } = fakeFactory({
      60: { success: false, remaining: 0, resetMs: NOW - 5_000 }, // 과거
      86_400: { success: true, remaining: 5, resetMs: NOW + 86_400_000 },
    });
    expect((await createKvRateLimiter({ now: clock, factory }).check('ip', RULES)).retryAfterSec).toBe(1);
  });
});
