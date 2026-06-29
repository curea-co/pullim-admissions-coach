// 교체 지점(B) — env-driven 어댑터 선택.
//   NEXT_PUBLIC_PULLIM_API 설정 시 → 실 인증(pullim-api 쿠키 SSO), 미설정 시 → mock(데모/CI/빌드).
//   레이트리밋 selectLimiter() 와 같은 패턴: API 미구성 환경은 안전하게 mock 폴백.
// 선행: pullim-api CORS/쿠키/CSRF(설계 §10) + 로컬 SSO 는 runbook(*.pullim.local).
// 로그인 진입은 OS 중앙(ADR-010) — ./os-login.ts (NEXT_PUBLIC_OS_URL).
import { mockAuthAdapter } from './mock-adapter';
import { pullimApiAuthAdapter } from './pullim-api-adapter';
import type { AuthAdapter } from './types';

export const auth: AuthAdapter = process.env.NEXT_PUBLIC_PULLIM_API
  ? pullimApiAuthAdapter
  : mockAuthAdapter;

export * from './types';
