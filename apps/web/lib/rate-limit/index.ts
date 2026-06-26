// 레이트리밋 교체점(단일 소스). 배포 시 이 파일에서 Upstash/KV 어댑터로 swap.
// import { createUpstashRateLimiter } from './upstash-adapter';
// export const rateLimiter = createUpstashRateLimiter();

import { createMemoryRateLimiter } from './memory-adapter';
import type { RateLimitRule } from './types';

export type { RateLimiter, RateLimitRule, RateLimitResult } from './types';

/** /api/analyze 베타 가드 규칙: IP 기준 버스트 + 일일 캡. */
export const ANALYZE_RATE_RULES: RateLimitRule[] = [
  { windowSec: 60, max: 3 }, // 버스트: 3회/분
  { windowSec: 86_400, max: 10 }, // 일일: 10회/일
];

/** 생기부 본문 베타 상한(자). opus 비용/지연 가드. 스키마(20만)보다 빡빡. */
export const MAX_SAENGBU_CHARS = 50_000;

export const rateLimiter = createMemoryRateLimiter();
