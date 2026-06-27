// 분산 레이트리밋 — Upstash Redis 슬라이딩 윈도우(@upstash/ratelimit).
// in-memory와 달리 서버리스 다중 인스턴스 간 카운터를 **공유**한다(프로덕션 정답).
//
// RateLimiter 인터페이스는 한 key에 여러 규칙(버스트+일일)을 받으므로, 규칙마다
// Ratelimit 인스턴스를 만들어 모두 통과해야 allowed로 본다(규칙별 prefix로 키 분리).
//
// 검증된 @upstash/ratelimit이 슬라이딩 윈도우 원자성을 담당하고, 여기서는 멀티룰 조합만
// 책임진다(그 부분만 단위 테스트 — 실 Redis는 라이브 e2e).

import { Ratelimit, type Duration } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { RateLimiter, RateLimitRule, RateLimitResult } from './types';

/** 한 규칙에 대한 리미터(테스트 주입용 최소 계약 — Ratelimit이 이를 충족). */
export interface RuleLimiter {
  limit(key: string): Promise<{ success: boolean; remaining: number; reset: number }>;
}
export type RuleLimiterFactory = (rule: RateLimitRule) => RuleLimiter;

/** Upstash(또는 Vercel KV) env에서 Redis를 만들고 규칙별 슬라이딩 윈도우 리미터를 생성. */
function defaultFactory(): RuleLimiterFactory {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error(
      'KV 레이트리밋 env 누락: UPSTASH_REDIS_REST_URL/TOKEN(또는 KV_REST_API_URL/TOKEN) 필요.'
    );
  }
  const redis = new Redis({ url, token });
  return (rule) =>
    new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(rule.max, `${rule.windowSec} s` as Duration),
      // 규칙(윈도우)별로 키 공간 분리 — 버스트와 일일 카운터가 섞이지 않게.
      prefix: `pullim:rl:${rule.windowSec}`,
      analytics: false,
    });
}

/** 가장 빡빡한(최소 max) 규칙 선택 — limit/remaining 보고용. */
function tightest<T extends { rule: RateLimitRule }>(items: T[]): T {
  return items.reduce((a, b) => (a.rule.max <= b.rule.max ? a : b));
}

export function createKvRateLimiter(
  opts: { factory?: RuleLimiterFactory; now?: () => number } = {}
): RateLimiter {
  const now = opts.now ?? (() => Date.now());
  const factory = opts.factory ?? defaultFactory();
  // 규칙(windowSec:max)별 리미터 캐시 — 매 호출 재생성 방지.
  const cache = new Map<string, RuleLimiter>();
  const limiterFor = (rule: RateLimitRule): RuleLimiter => {
    const k = `${rule.windowSec}:${rule.max}`;
    let l = cache.get(k);
    if (!l) {
      l = factory(rule);
      cache.set(k, l);
    }
    return l;
  };

  return {
    async check(key: string, rules: RateLimitRule[]): Promise<RateLimitResult> {
      const results = await Promise.all(
        rules.map(async (rule) => ({ rule, res: await limiterFor(rule).limit(key) }))
      );

      const blocked = results.filter((r) => !r.res.success);
      if (blocked.length > 0) {
        // 차단을 유발한 규칙들 중 가장 늦게 풀리는 시각까지 대기.
        const retryAfterSec = Math.max(
          ...blocked.map((b) => Math.max(1, Math.ceil((b.res.reset - now()) / 1000)))
        );
        const t = tightest(blocked);
        return { allowed: false, retryAfterSec, limit: t.rule.max, remaining: 0 };
      }

      const t = tightest(results);
      return {
        allowed: true,
        retryAfterSec: 0,
        limit: t.rule.max,
        remaining: Math.max(0, t.res.remaining),
      };
    },
  };
}
