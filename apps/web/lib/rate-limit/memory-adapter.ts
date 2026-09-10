// in-memory 레이트리밋(베타 기본). 단일 프로세스/웜 람다 내에서만 공유됨.
// 주의(프로덕션): 서버리스 다중 인스턴스 간에는 공유되지 않으므로, 배포 시
// index.ts의 교체점에서 Upstash/Vercel KV 구현으로 swap 필요.

import type { RateLimiter, RateLimitRule, RateLimitResult } from './types';

interface MemoryOpts {
  /** 보관할 최대 key 수(초과 시 가장 오래 안 쓰인 key부터 evict). 메모리 상한. */
  maxKeys?: number;
  /** 테스트용 클록 주입. 기본 Date.now. */
  now?: () => number;
}

/**
 * 슬라이딩 윈도우: key별 요청 타임스탬프(ms) 목록을 유지하고,
 * 규칙별 윈도우 내 개수를 세어 초과 여부를 판정한다.
 */
export function createMemoryRateLimiter(opts: MemoryOpts = {}): RateLimiter {
  const maxKeys = opts.maxKeys ?? 10_000;
  const now = opts.now ?? (() => Date.now());
  // key -> 타임스탬프(ms) 오름차순 목록
  const hits = new Map<string, number[]>();

  function prune(list: number[], horizonMs: number, t: number): number[] {
    const cutoff = t - horizonMs;
    // 가장 긴 윈도우(horizon)보다 오래된 것은 어떤 규칙에도 무의미 → 제거
    let i = 0;
    while (i < list.length && list[i] <= cutoff) i++;
    return i === 0 ? list : list.slice(i);
  }

  return {
    async check(key: string, rules: RateLimitRule[]): Promise<RateLimitResult> {
      const t = now();
      const maxWindowMs = Math.max(...rules.map((r) => r.windowSec)) * 1000;

      // LRU 유사 evict: 용량 초과 시 첫(가장 오래된 삽입) key 제거.
      if (!hits.has(key) && hits.size >= maxKeys) {
        const oldest = hits.keys().next().value;
        if (oldest !== undefined) hits.delete(oldest);
      }

      const existing = prune(hits.get(key) ?? [], maxWindowMs, t);

      // 가장 빡빡한 규칙(최소 max) 기준 remaining 계산용
      let tightestRemaining = Infinity;
      let tightestLimit = Infinity;
      let blockedRetryAfter = 0;

      for (const rule of rules) {
        const windowMs = rule.windowSec * 1000;
        const windowStart = t - windowMs;
        const inWindow = existing.filter((ts) => ts > windowStart);
        const remaining = rule.max - inWindow.length;

        if (remaining < tightestRemaining) {
          tightestRemaining = remaining;
          tightestLimit = rule.max;
        }

        if (inWindow.length >= rule.max) {
          // 이 규칙 초과 — 윈도우 내 가장 오래된 요청이 빠질 때까지 대기
          const oldestInWindow = inWindow[0];
          const retry = Math.ceil((oldestInWindow + windowMs - t) / 1000);
          blockedRetryAfter = Math.max(blockedRetryAfter, Math.max(1, retry));
        }
      }

      if (blockedRetryAfter > 0) {
        // 차단: 기록하지 않음(차단된 호출이 윈도우를 더 늘리지 않도록).
        // pruned 결과는 반영해 메모리는 정리.
        hits.set(key, existing);
        return {
          allowed: false,
          retryAfterSec: blockedRetryAfter,
          limit: tightestLimit,
          remaining: 0,
        };
      }

      existing.push(t);
      hits.set(key, existing);
      return {
        allowed: true,
        retryAfterSec: 0,
        limit: tightestLimit,
        remaining: Math.max(0, tightestRemaining - 1),
      };
    },
  };
}
