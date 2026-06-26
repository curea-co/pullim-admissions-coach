// 레이트리밋 교체점(단일 소스). 배포 시 이 파일에서 Upstash/KV 어댑터로 swap.
// import { createUpstashRateLimiter } from './upstash-adapter';
// export const rateLimiter = createUpstashRateLimiter();

import { createMemoryRateLimiter } from './memory-adapter';
import type { RateLimiter, RateLimitRule } from './types';

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
// 막기 위해, 공유 스토어(KV) 어댑터가 붙기 전까지는 **명시적 옵트인**을 요구한다.
//   - 개발/테스트: 그대로 in-memory 사용.
//   - 프로덕션: RATE_LIMIT_BACKEND=memory 를 명시하지 않으면 첫 호출에서 throw(라우트가
//     500으로 처리) → 잘못된 배포가 조용히 통과하지 않는다. KV 도입 시 이 분기를
//     createKvRateLimiter()로 교체.
// 지연 평가(모듈 로드 시점 throw 금지): NODE_ENV=production 으로 도는 `next build`를
// 깨뜨리지 않도록 첫 check() 호출에서 판정한다.
function selectLimiter(): RateLimiter {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.RATE_LIMIT_BACKEND !== 'memory'
  ) {
    throw new Error(
      '레이트리밋 백엔드가 프로덕션용으로 구성되지 않았습니다. 공유 스토어(KV) 어댑터를 ' +
        'lib/rate-limit/index.ts에 연결하거나, in-memory(인스턴스 간 비공유)를 의도적으로 ' +
        '허용하려면 RATE_LIMIT_BACKEND=memory 를 설정하세요.'
    );
  }
  return createMemoryRateLimiter();
}

let _limiter: RateLimiter | null = null;
export const rateLimiter: RateLimiter = {
  check(key, rules) {
    if (!_limiter) _limiter = selectLimiter();
    return _limiter.check(key, rules);
  },
};
