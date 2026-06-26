// 교체 지점(B) — 실 인증 연동 시 한 줄만 바꾼다.
//   import { pullimApiAuthAdapter } from './pullim-api-adapter';
//   export const auth: AuthAdapter = pullimApiAuthAdapter;
// 선행: NEXT_PUBLIC_PULLIM_API 설정 + pullim-api CORS/쿠키/CSRF(설계 §10).
// 스캐폴드: ./pullim-api-adapter.ts (lib/api.ts 전송 계층 사용).
import { mockAuthAdapter } from './mock-adapter';
import type { AuthAdapter } from './types';
export const auth: AuthAdapter = mockAuthAdapter;
export * from './types';
