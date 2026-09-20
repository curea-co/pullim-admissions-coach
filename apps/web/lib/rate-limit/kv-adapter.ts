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
  /** 1회 소비하고 판정. `reason: 'timeout'` 은 저장소 응답을 못 받고 **허용으로 넘긴** 경우다. */
  limit(
    key: string,
  ): Promise<{ success: boolean; remaining: number; reset: number; reason?: string }>;
  /** **소비 없이** 남은 허용량만 본다. 여러 규칙을 함께 볼 때 필요하다. */
  getRemaining(key: string): Promise<{ remaining: number; reset: number }>;
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
      // ⚠️ 기본값(5000)은 **fail-open** 이다 — 그 시간 안에 Redis 응답이 없으면 SDK 가 예외가
      //    아니라 `{ success: true, reason: 'timeout' }` 을 돌려준다. 그러면 호출부의 503
      //    fail-closed 경로를 그냥 지나쳐 공개 발송 라우트의 보호가 사라진다. 0 으로 끈다.
      timeout: 0,
    });
}

/**
 * 저장소 응답을 기다리는 상한. 넘으면 **거절(reject)** 한다 — 호출부(app/api/feedback)가
 * 503 fail-closed 로 받는다. 지연을 허용으로 넘기면 보호가 무력화된다.
 */
const KV_OP_TIMEOUT_MS = 1_500;

function withDeadline<T>(op: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`KV 레이트리밋 ${what} 응답 지연(${ms}ms) — 허용하지 않는다`)),
      ms,
    );
    op.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** SDK 가 지연을 허용으로 넘긴 응답인지 — 그렇다면 판정으로 인정하지 않는다. */
function rejectFailOpen<T extends { reason?: string }>(res: T, what: string): T {
  if (res.reason === 'timeout') {
    throw new Error(`KV 레이트리밋 ${what} 이 저장소 응답 없이 허용으로 넘어왔다 — 인정하지 않는다`);
  }
  return res;
}

export function createKvRateLimiter(
  opts: { factory?: RuleLimiterFactory; now?: () => number; opTimeoutMs?: number } = {}
): RateLimiter {
  const now = opts.now ?? (() => Date.now());
  const opTimeoutMs = opts.opTimeoutMs ?? KV_OP_TIMEOUT_MS;
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
      // @upstash/ratelimit의 limit()은 매 호출 quota를 차감한다. 규칙이 여러 개면 앞 규칙을
      // 통과(=소비)한 뒤 뒤 규칙에서 막히는 요청이 생기고, 그러면 **차단된 요청이 앞 규칙의
      // quota를 깎는다** — memory-adapter 계약("막힌 호출은 기록하지 않음")과 어긋나고, 시간당
      // 한도에 걸린 사용자가 재시도할수록 버스트 quota까지 태운다.
      // 그래서 소비 전에 **소비 없는 peek**으로 전부 확인한다.
      // ⚠️ peek 과 소비 사이의 경합(동시 요청)까지는 닫지 못한다 — 원자적 다중 규칙 평가는
      //    저장소 측 스크립트가 필요하다. 과허용은 동시 요청 수만큼으로 제한된다.
      if (rules.length > 1) {
        const peeks = await Promise.all(
          rules.map(async (rule) => ({
            rule,
            res: await withDeadline(limiterFor(rule).getRemaining(key), opTimeoutMs, 'getRemaining'),
          })),
        );
        const short = peeks.find((p) => p.res.remaining <= 0);
        if (short) {
          const retryAfterSec = Math.max(1, Math.ceil((short.res.reset - now()) / 1000));
          return { allowed: false, retryAfterSec, limit: short.rule.max, remaining: 0 };
        }
      }

      const passed: { rule: RateLimitRule; remaining: number }[] = [];
      // 실제 소비. 순차 + 첫 차단 시 단락 — 경합으로 peek 이후 상황이 바뀐 경우만 여기 걸린다.
      for (const rule of rules) {
        const res = rejectFailOpen(
          await withDeadline(limiterFor(rule).limit(key), opTimeoutMs, 'limit'),
          'limit',
        );
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
