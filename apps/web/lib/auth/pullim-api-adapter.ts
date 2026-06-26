'use client';

/**
 * 실 인증 어댑터 (B) — pullim-api(NestJS) 연동 **스캐폴드**.
 *
 * 설계: docs/superpowers/specs/2026-06-24-auth-mypage-design.md
 * 전송: lib/api.ts(`createApiClient` — CSRF·401 single-flight refresh·에러 정규화).
 *
 * 직원 작업(플랜 단계):
 *  1) pullim-api Swagger(`/api-docs`)로 각 엔드포인트의 실제 요청/응답 DTO 확정.
 *  2) 아래 `mapMe`/요청 바디의 TODO를 실제 필드명으로 채운다.
 *  3) `lib/auth/index.ts`에서 `export const auth = pullimApiAuthAdapter`로 교체.
 *  4) pullim-api 선행조건(설계 §10): CORS 허용·쿠키 Domain/SameSite·CSRF 응답 형태.
 *
 * 미완 상태로 임포트해도 typecheck/build는 통과한다(런타임 호출 시에만 네트워크 사용).
 */

import { api } from '@/lib/api';
import type {
  AuthAdapter,
  User,
  SignupInput,
  GuardianInput,
  DiagnosisSummary,
  SignupResult,
  AgeBand,
} from './types';

// pullim-api `GET /me` 응답(부분) — TODO(B): Swagger me-response.dto와 정합 확인.
interface MeResponse {
  sub: string;
  email: string;
  displayName: string;
  ageBand: AgeBand;
  // ⚠️ 미성년(만19) 판정은 isMinor가 권위 — ageBand(만14)와 혼동 금지(설계 §5).
  // 서버가 isMinor를 안 주면 pullim-api에 추가 요청(설계 §5 게이트).
  isMinor: boolean;
  guardianConsent?: 'none' | 'pending' | 'approved';
}

interface EntitlementsResponse {
  package: string;
  tier: string;
}

/** MeResponse(+entitlements) → 앱 User. TODO(B): 필드명 실제 응답과 정합. */
function mapMe(me: MeResponse, ent: EntitlementsResponse): User {
  return {
    id: me.sub,
    email: me.email,
    displayName: me.displayName,
    ageBand: me.ageBand,
    isMinor: me.isMinor,
    guardianConsent: me.guardianConsent ?? 'none',
    package: ent.package,
    tier: ent.tier,
  };
}

export const pullimApiAuthAdapter: AuthAdapter = {
  async getMe(): Promise<User | null> {
    try {
      // TODO(B): /me 와 /me/entitlements 병합. 비로그인 시 401 → null.
      const me = await api.get<MeResponse>('/me');
      const ent = await api.get<EntitlementsResponse>('/me/entitlements');
      return mapMe(me, ent);
    } catch {
      return null; // 미인증/만료 → 게스트
    }
  },

  async signup(input: SignupInput): Promise<SignupResult> {
    // TODO(B): signup-request.dto 필드명 확정(email/password/displayName/birthDate).
    const res = await api.post<{ user: MeResponse; needsEmailVerify: boolean; needsGuardianConsent: boolean }>(
      '/auth/signup',
      input
    );
    const ent = await api.get<EntitlementsResponse>('/me/entitlements').catch(() => ({ package: 'home', tier: 'free' }));
    return {
      user: mapMe(res.user, ent),
      needsEmailVerify: res.needsEmailVerify,
      needsGuardianConsent: res.needsGuardianConsent,
    };
  },

  async verifyEmail(code: string): Promise<void> {
    // TODO(B): 요청 바디 필드명(code/token) 확정.
    await api.post('/auth/email-verification/verify', { code });
  },

  async submitGuardianConsent(input: GuardianInput): Promise<void> {
    // TODO(B): guardian-consent dto 정합(guardianName/relation/phone).
    await api.post('/auth/signup/guardian-consent', input);
  },

  async login(email: string, password: string): Promise<User> {
    await api.post('/auth/login', { email, password });
    const me = await api.get<MeResponse>('/me');
    const ent = await api.get<EntitlementsResponse>('/me/entitlements');
    return mapMe(me, ent);
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },

  async deleteAccount(): Promise<void> {
    // TODO(B): /account/delete 즉시삭제/유예(+/delete/cancel) 정책 확정.
    await api.post('/account/delete');
  },

  async listDiagnoses(): Promise<DiagnosisSummary[]> {
    // TODO(B/C): 진단 이력은 결과 영속(C, 하위프로젝트 3) 백엔드가 선행.
    // 그 전까지는 빈 배열(마이페이지는 "곧" placeholder).
    return [];
  },
};
