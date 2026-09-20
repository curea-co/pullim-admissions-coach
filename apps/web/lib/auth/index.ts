// 교체 지점(B) — **명시 옵트인** 방식.
//   - 실 어댑터(pullim-api)는 NEXT_PUBLIC_AUTH_BACKEND=pullim 일 때만 활성.
//   - 그 외(미설정 등)는 mock(데모).
// URL(NEXT_PUBLIC_PULLIM_API) 존재만으로는 전환하지 않는다 — URL이 실수로/일부만
// 주입된 배포에서 미완성 어댑터로 인증이 조용히 깨지는 것을 막기 위한 명시적 게이트.
// 실 전환 시 둘 다 필요: NEXT_PUBLIC_AUTH_BACKEND=pullim + NEXT_PUBLIC_PULLIM_API=<url>.
// 선행: pullim-api CORS/쿠키/CSRF(설계 §10) + 어댑터 DTO TODO 채우기(./pullim-api-adapter.ts).
// 전송 계층: lib/api.ts(URL 미설정이면 호출 시 fail-closed).
import { mockAuthAdapter } from './mock-adapter';
import { pullimApiAuthAdapter } from './pullim-api-adapter';
import type { AuthAdapter } from './types';

const usePullimApi = process.env.NEXT_PUBLIC_AUTH_BACKEND === 'pullim';
export const auth: AuthAdapter = usePullimApi ? pullimApiAuthAdapter : mockAuthAdapter;

/** 실 auth(pullim-api) 모드 여부 — mock/데모(false)에는 엔타이틀먼트/구매 벽 개념이 없다. */
export const isPullimAuth = usePullimApi;

export * from './types';
