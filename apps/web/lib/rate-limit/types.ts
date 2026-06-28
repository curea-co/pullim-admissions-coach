// /api/analyze 남용 가드 — 레이트리밋 추상화(스펙 §8).
// 인증 전 무차별 호출 + opus 풀 파이프라인(과금)을 막는 베타 가드.
// AuthAdapter 패턴: 단일 교체점(index.ts)에서 in-memory ↔ Upstash/KV 스왑.

/** 한 윈도우 규칙: windowSec 동안 max회 허용. */
export interface RateLimitRule {
  /** 윈도우 길이(초) */
  windowSec: number;
  /** 윈도우 내 허용 횟수 */
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** 차단 시 재시도까지 권장 대기(초). 허용 시 0. */
  retryAfterSec: number;
  /** 차단을 유발한 규칙의 max(허용 시 binding 규칙의 max). */
  limit: number;
  /** 허용 시 남은 허용 횟수 — 가장 적게 남은(binding) 규칙 기준. */
  remaining: number;
}

export interface RateLimiter {
  /**
   * key(보통 IP)에 대해 rules를 검사하고 1회 사용을 기록한다.
   * 어느 규칙이라도 초과하면 allowed=false.
   *
   * **소비(consume) 의미 — 어댑터별 차이:**
   * - `memory`: 차단 시 어떤 규칙도 기록하지 않음(정확).
   * - `kv`(Upstash): 규칙을 좁은 윈도우부터 순차 검사하고 차단 즉시 단락하므로, 차단을
   *   유발한 규칙 *이후* 규칙은 소비하지 않는다. 다만 앞 규칙이 통과한 뒤 뒤 규칙에서
   *   막히면 앞 규칙은 이미 소비됐다(@upstash/ratelimit가 check-and-increment라 비소비
   *   peek이 없음). 이는 **항상 더 보수적(과소비=더 일찍 차단, 과소차단 없음)** 이며 짧은
   *   윈도우(버스트)부터 두므로 자가 회복이 빠르다. 비용 가드로는 안전한 방향.
   *   완전한 교차규칙 원자성은 단일 Lua 멀티-티어 구현이 필요(후속).
   */
  check(key: string, rules: RateLimitRule[]): Promise<RateLimitResult>;
}
