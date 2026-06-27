// 레이트리밋 교체점(단일 소스). RATE_LIMIT_BACKEND로 백엔드 선택:
//   - 'memory'(기본): in-memory(인스턴스별 — dev/단일 인스턴스용).
//   - 'kv': Upstash Redis 분산(프로덕션 정답). UPSTASH_REDIS_REST_URL/TOKEN
//           (또는 KV_REST_API_URL/TOKEN) 필요. kv-adapter는 동적 import(메모리 모드는 미로드).

import { createMemoryRateLimiter } from './memory-adapter';
import type { RateLimiter, RateLimitRule } from './types';

/** KV(Upstash/Vercel KV) 연결 env가 있는지 — 호출 시점에 읽는다(테스트/런타임 모두 정확). */
function kvEnvPresent(): boolean {
  return Boolean(
    (process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL) &&
      (process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN)
  );
}

export type { RateLimiter, RateLimitRule, RateLimitResult } from './types';

/** /api/analyze 베타 가드 규칙: IP 기준 버스트 + 일일 캡. */
export const ANALYZE_RATE_RULES: RateLimitRule[] = [
  { windowSec: 60, max: 3 }, // 버스트: 3회/분
  { windowSec: 86_400, max: 10 }, // 일일: 10회/일
];

/** 생기부 본문 베타 상한(자). opus 비용/지연 가드. 스키마(20만)보다 빡빡. */
export const MAX_SAENGBU_CHARS = 50_000;

// in-memory 리미터는 서버리스 다중 인스턴스에서 인스턴스별로 분리되어 일일/버스트
// 제한을 거의 보장하지 못한다. 프로덕션에서 비용 보호가 무력화된 채 조용히 도는 사고를
// 막기 위해, 백엔드를 **명시적 옵트인**으로 요구한다(아래 rateLimitConfigError).
/**
 * 프로덕션 레이트리밋 구성이 유효한지 — 유효하면 null, 아니면 사유.
 * selectLimiter(fail-closed 강제)와 /api/health(analyzeReady)가 **공유하는 단일 소스**.
 *   - 'kv': 분산(프로덕션 권장). Upstash/KV env가 있어야 유효.
 *   - 'memory': in-memory(단일 인스턴스 한정 — 분산에선 약함). 명시 옵트인.
 *   - 그 외/미설정: fail-closed(잘못된 배포가 조용히 통과하지 않게).
 */
export function rateLimitConfigError(): string | null {
  if (process.env.NODE_ENV !== 'production') return null;
  const backend = process.env.RATE_LIMIT_BACKEND;
  if (backend === 'kv') {
    return kvEnvPresent()
      ? null
      : 'RATE_LIMIT_BACKEND=kv이지만 Upstash/KV env(UPSTASH_REDIS_REST_URL/TOKEN 등)가 없습니다.';
  }
  if (backend === 'memory') return null;
  return '레이트리밋 백엔드가 구성되지 않았습니다(RATE_LIMIT_BACKEND=kv 권장, 또는 단일 인스턴스면 memory).';
}

// 지연 평가(모듈 로드 시점 throw 금지): NODE_ENV=production 으로 도는 `next build`를
// 깨뜨리지 않도록 첫 check() 호출에서 판정한다. KV 어댑터는 동적 import(메모리 모드 미로드).
async function selectLimiter(): Promise<RateLimiter> {
  const err = rateLimitConfigError();
  if (err) {
    throw new Error(
      `${err} 프로덕션 권장: RATE_LIMIT_BACKEND=kv + Upstash env. ` +
        '단일 인스턴스 한정으로 in-memory를 의도적으로 허용하려면 RATE_LIMIT_BACKEND=memory.'
    );
  }
  if (process.env.RATE_LIMIT_BACKEND === 'kv') {
    const { createKvRateLimiter } = await import('./kv-adapter');
    return createKvRateLimiter();
  }
  return createMemoryRateLimiter();
}

let _limiterPromise: Promise<RateLimiter> | null = null;
export const rateLimiter: RateLimiter = {
  check(key, rules) {
    if (!_limiterPromise) _limiterPromise = selectLimiter();
    return _limiterPromise.then((l) => l.check(key, rules));
  },
};
