// 교체 지점(B) — **env 게이트** 방식.
//   - NEXT_PUBLIC_PULLIM_API 가 설정되면 → 실 어댑터(pullim-api 연동).
//   - 미설정이면 → mock(데모). 따라서 env만 채우면 자동 전환되고, 안 채우면 앱이 그대로 동작.
// 선행: pullim-api CORS/쿠키/CSRF(설계 §10) + 어댑터 DTO TODO 채우기(./pullim-api-adapter.ts).
// 전송 계층: lib/api.ts.
import { mockAuthAdapter } from './mock-adapter';
import { pullimApiAuthAdapter } from './pullim-api-adapter';
import type { AuthAdapter } from './types';

const usePullimApi = Boolean(process.env.NEXT_PUBLIC_PULLIM_API);
export const auth: AuthAdapter = usePullimApi ? pullimApiAuthAdapter : mockAuthAdapter;

export * from './types';
