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
  /** 차단을 유발한 규칙의 max(허용 시 가장 빡빡한 규칙의 max). */
  limit: number;
  /** 가장 빡빡한 규칙 기준 남은 허용 횟수(허용 시). */
  remaining: number;
}

export interface RateLimiter {
  /**
   * key(보통 IP)에 대해 rules를 모두 검사하고 1회 사용을 기록한다.
   * 어느 규칙이라도 초과하면 allowed=false(기록하지 않음).
   */
  check(key: string, rules: RateLimitRule[]): Promise<RateLimitResult>;
}
