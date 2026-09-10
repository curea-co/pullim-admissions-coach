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

/** 규칙별 고정 응답 + 호출 횟수 기록(단락·소비 검증용). */
function fakeFactory(byWindow: Record<number, RuleResp>) {
  const calls: Record<number, number> = {};
  const peeks: Record<number, number> = {};
  const factory: RuleLimiterFactory = (rule) => ({
    async limit() {
      calls[rule.windowSec] = (calls[rule.windowSec] ?? 0) + 1;
      const r = byWindow[rule.windowSec];
      return { success: r.success, remaining: r.remaining, reset: r.resetMs };
    },
    // peek 은 소비하지 않는다 — 남은 양은 limit() 이 돌려줄 값과 같은 소스로 흉내 낸다.
    async getRemaining() {
      peeks[rule.windowSec] = (peeks[rule.windowSec] ?? 0) + 1;
      const r = byWindow[rule.windowSec];
      return { remaining: r.success ? Math.max(1, r.remaining) : 0, reset: r.resetMs };
    },
  });
  return { factory, calls, peeks };
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

  it('버스트가 소진이면 어느 규칙의 quota도 차감하지 않고 차단', async () => {
    const { factory, calls } = fakeFactory({
      60: { success: false, remaining: 0, resetMs: NOW + 30_000 }, // 버스트 차단
      86_400: { success: true, remaining: 5, resetMs: NOW + 86_400_000 },
    });
    const res = await createKvRateLimiter({ now: clock, factory }).check('ip', RULES);
    expect(res.allowed).toBe(false);
    expect(res.retryAfterSec).toBe(30); // 버스트 reset 기준
    // 차단은 소비 없는 peek 단계에서 판정된다 — 어느 규칙의 quota 도 깎지 않는다.
    expect(calls[60]).toBeUndefined();
    expect(calls[86_400]).toBeUndefined();
  });

  it('버스트 통과·일일 차단 → blocked(일일 reset 기준)', async () => {
    const { factory, calls } = fakeFactory({
      60: { success: true, remaining: 2, resetMs: NOW + 60_000 },
      86_400: { success: false, remaining: 0, resetMs: NOW + 50_000 },
    });
    const res = await createKvRateLimiter({ now: clock, factory }).check('ip', RULES);
    expect(res.allowed).toBe(false);
    expect(res.retryAfterSec).toBe(50);
    // 일일이 막는데 버스트를 미리 깎지 않는다(재시도할수록 버스트까지 태우는 문제).
    expect(calls[60]).toBeUndefined();
    expect(calls[86_400]).toBeUndefined();
  });

  it('retryAfter는 최소 1초(이미 지난 reset도)', async () => {
    const { factory } = fakeFactory({
      60: { success: false, remaining: 0, resetMs: NOW - 5_000 }, // 과거
      86_400: { success: true, remaining: 5, resetMs: NOW + 86_400_000 },
    });
    expect((await createKvRateLimiter({ now: clock, factory }).check('ip', RULES)).retryAfterSec).toBe(1);
  });
});

describe('createKvRateLimiter — 차단된 요청은 어떤 규칙의 quota도 소비하지 않는다', () => {
  it('뒤 규칙(일일)이 이미 소진이면 앞 규칙(버스트)을 **소비하지 않고** 차단한다', async () => {
    // 소비형 limit() 만으로 순차 검사하면, 버스트를 통과(=차감)한 뒤 일일에서 막힌다.
    // 그러면 시간당 한도에 걸린 사용자가 재시도할수록 버스트 quota까지 태운다.
    const { factory, calls } = fakeFactory({
      60: { success: true, remaining: 2, resetMs: NOW + 60_000 },
      86_400: { success: false, remaining: 0, resetMs: NOW + 3_600_000 },
    });
    const res = await createKvRateLimiter({ now: clock, factory }).check('ip', RULES);

    expect(res.allowed).toBe(false);
    expect(res.limit).toBe(10); // 막은 규칙(일일)
    expect(calls[60]).toBeUndefined(); // 버스트 quota는 건드리지 않았다
    expect(calls[86_400]).toBeUndefined();
  });

  it('규칙이 하나면 peek 없이 바로 소비한다(단일 규칙은 그 자체로 원자적)', async () => {
    const { factory, calls, peeks } = fakeFactory({
      60: { success: true, remaining: 2, resetMs: NOW + 60_000 },
    });
    const res = await createKvRateLimiter({ now: clock, factory }).check('ip', [RULES[0]]);
    expect(res.allowed).toBe(true);
    expect(calls[60]).toBe(1);
    expect(peeks[60]).toBeUndefined();
  });
});
