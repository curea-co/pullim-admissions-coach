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
import { resolveKvCreds } from './kv-creds';
import type { RateLimiter, RateLimitRule, RateLimitResult } from './types';

/** 한 규칙에 대한 리미터(테스트 주입용 최소 계약 — Ratelimit이 이를 충족). */
export interface RuleLimiter {
  limit(key: string): Promise<{ success: boolean; remaining: number; reset: number }>;
}
export type RuleLimiterFactory = (rule: RateLimitRule) => RuleLimiter;

/** Upstash(또는 Vercel KV) env에서 Redis를 만들고 규칙별 슬라이딩 윈도우 리미터를 생성. */
function defaultFactory(): RuleLimiterFactory {
  const creds = resolveKvCreds(); // 한 provider의 완전한 쌍만(혼합 방지, index와 단일 소스)
  if (!creds) {
    throw new Error(
      'KV 레이트리밋 env 누락: UPSTASH_REDIS_REST_URL/TOKEN(또는 KV_REST_API_URL/TOKEN) 한 쌍 필요.'
    );
  }
  const redis = new Redis(creds);
  return (rule) =>
    new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(rule.max, `${rule.windowSec} s` as Duration),
      // 규칙(윈도우+상한)별로 키 공간 분리 — 윈도우 같고 max만 다른 규칙이나, 롤링 배포 중
      // max가 바뀌는 경우에도 서로 다른 정책이 같은 카운터를 공유하지 않게 한다.
      prefix: `pullim:rl:${rule.windowSec}:${rule.max}`,
      analytics: false,
    });
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
      // @upstash/ratelimit의 limit()은 매 호출 quota를 차감한다. memory-adapter 계약
      // ("막힌 호출은 기록하지 않음")에 맞추려면 **순차 검사 + 첫 차단 시 단락**해야 한다 —
      // 그래야 한 규칙에서 막힌 요청이 이후 규칙(예: 일일 캡)의 quota를 더 깎지 않는다.
      // 규칙은 좁은 윈도우(버스트)부터 두는 것을 권장(자주 막히는 규칙을 먼저 단락).
      const passed: { rule: RateLimitRule; remaining: number }[] = [];
      for (const rule of rules) {
        const res = await limiterFor(rule).limit(key);
        if (!res.success) {
          const retryAfterSec = Math.max(1, Math.ceil((res.reset - now()) / 1000));
          return { allowed: false, retryAfterSec, limit: rule.max, remaining: 0 };
        }
        passed.push({ rule, remaining: res.remaining });
      }

      // 전부 통과 — 실제 남은 허용 횟수는 가장 적게 남은(binding) 규칙이 결정한다.
      const binding = passed.reduce((a, b) => (a.remaining <= b.remaining ? a : b));
      return {
        allowed: true,
        retryAfterSec: 0,
        limit: binding.rule.max,
        remaining: Math.max(0, binding.remaining),
      };
    },
  };
}
