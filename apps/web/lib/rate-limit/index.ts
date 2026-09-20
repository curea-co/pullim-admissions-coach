// 레이트리밋 교체점(단일 소스). RATE_LIMIT_BACKEND로 백엔드 선택:
//   - 'memory'(기본): in-memory(인스턴스별 — dev/단일 인스턴스용).
//   - 'kv': Upstash Redis 분산(프로덕션 정답). UPSTASH_REDIS_REST_URL/TOKEN
//           (또는 KV_REST_API_URL/TOKEN) 필요. kv-adapter는 동적 import(메모리 모드는 미로드).

import { createMemoryRateLimiter } from './memory-adapter';
import { resolveKvCreds } from './kv-creds';
import type { RateLimiter, RateLimitRule } from './types';

/** KV 연결 자격증명(한 provider의 완전한 쌍)이 있는지 — kv-adapter와 단일 소스 공유. */
function kvEnvPresent(): boolean {
  return resolveKvCreds() !== null;
}

export type { RateLimiter, RateLimitRule, RateLimitResult } from './types';

/**
 * /api/feedback 남용 가드 규칙 — 호출자 식별자(보통 IP) 기준 버스트 + 시간당 캡.
 * 사람이 건의를 쓰는 속도로는 절대 닿지 않는 값이다(1분에 3번, 1시간에 20번).
 */
export const FEEDBACK_RATE_RULES: RateLimitRule[] = [
  { windowSec: 60, max: 3 }, // 버스트: 3회/분
  { windowSec: 3_600, max: 20 }, // 시간당 20회
];

/**
 * 식별자와 **무관한** 전체 상한. 호출자 식별자(x-forwarded-for)는 프록시 구성에 따라
 * 위조될 수 있어 IP 를 갈아 끼우면 위 규칙을 우회할 수 있다. 그래도 수집처로 나가는
 * 총량은 이 캡을 넘지 못한다 — 우회 가능한 방어 위에 우회 불가능한 천장을 하나 더 둔다.
 */
export const FEEDBACK_GLOBAL_RATE_RULES: RateLimitRule[] = [
  // 창을 짧게(5분) 잡는다: 같은 총량 상한을 한 시간짜리 창으로 두면, 한 번의 버스트로 창이 차는
  // 순간 **모두가 한 시간 동안** 막힌다. 5분이면 막혀도 몇 분 안에 풀린다(상한의 목적은
  // 수집처로 나가는 총량을 묶는 것이지 서비스를 오래 닫는 것이 아니다).
  { windowSec: 300, max: 30 },
];
/** 전체 상한용 고정 키 — 호출자와 무관하게 한 카운터를 공유한다. */
export const FEEDBACK_GLOBAL_KEY = 'feedback:__all__';

// in-memory 리미터는 서버리스 다중 인스턴스에서 인스턴스별로 분리되어 시간당/버스트
// 제한을 거의 보장하지 못한다. 프로덕션에서 남용 보호가 무력화된 채 조용히 도는 사고를
// 막기 위해, 백엔드를 **명시적 옵트인**으로 요구한다(아래 rateLimitConfigError).
/**
 * 프로덕션 레이트리밋 구성이 유효한지 — 유효하면 null, 아니면 사유.
 * selectLimiter(fail-closed 강제)와 호출부(app/api/feedback)가 **공유하는 단일 소스**.
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

/** 지연 init + 실패 미캐시를 감싼 싱글톤 하나. 인스턴스마다 **자기 저장소**를 갖는다. */
function createLazySingleton(): RateLimiter {
  let promise: Promise<RateLimiter> | null = null;
  return {
    check(key, rules) {
      if (!promise) {
        promise = selectLimiter();
        // 초기화 실패(콜드스타트 Upstash 일시 장애·동적 import 실패 등)가 프로세스 수명 동안
        // 캐시돼 영구 500이 되지 않도록, reject 시 캐시를 비워 다음 호출에서 재시도하게 한다.
        promise.catch(() => {
          promise = null;
        });
      }
      return promise.then((l) => l.check(key, rules));
    },
  };
}

/** 호출자(IP)별 한도용. */
export const rateLimiter: RateLimiter = createLazySingleton();

/**
 * 전체 상한 전용 — 호출자 리미터와 **저장소를 분리한다.**
 * in-memory 어댑터는 키가 maxKeys 를 넘으면 오래된 키부터 밀어낸다. 호출자 키는 위조 가능한
 * 헤더에서 오므로, 같은 저장소를 쓰면 공격자가 서로 다른 헤더 값을 대량으로 밀어 넣어
 * **전체 카운터를 축출**하고 상한을 초기화할 수 있다. 저장소가 다르면 그 경로가 사라진다.
 */
export const globalRateLimiter: RateLimiter = createLazySingleton();
