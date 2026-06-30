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

import { api, type ApiError } from '@/lib/api';
import type {
  AuthAdapter,
  User,
  SignupInput,
  GuardianInput,
  DiagnosisSummary,
  SignupResult,
  AgeBand,
} from './types';

// pullim-api `GET /me` 응답 — me-response.dto.ts(2026-06 확인)와 정합.
// package·tier 가 /me 에 직접 포함되어 별도 /me/entitlements 병합 불필요.
interface MeResponse {
  sub: string;
  email: string;
  displayName: string;
  ageBand: AgeBand; // under14|over14|unknown (만14 경계 — birth_date 복호 만나이)
  isMinor: boolean; // 만19 미만 — /me 권위값(birth_date 파생, fail-closed true). ageBand(만14)와 별개.
  package: string; // entitlements.package
  tier: string; // entitlements.tier
  role: string; // student|parent|teacher|institution
}

/** MeResponse → 앱 User. */
function mapMe(me: MeResponse): User {
  return {
    id: me.sub,
    email: me.email,
    displayName: me.displayName,
    ageBand: me.ageBand,
    // 만19 isMinor 는 /me 권위값을 그대로 쓴다(이전 ageBand 근사 폐기 — 만14-18 미성년 오분류 회귀 해소).
    // 구버전 api(필드 부재) 대비 fail-closed: 미상 시 보수적 true(미성년 보호 우선).
    isMinor: me.isMinor ?? true,
    // 입시 학부모 동의(만19)는 **admissions 도메인** 소관 — auth /me 의 만14 KCB guardian_consents 와 별개라
    // 여기서 권위값을 줄 수 없다. 입시 동의 흐름(admissions consents)이 정본 — 그 전까지 'none'(미기록).
    guardianConsent: 'none',
    package: me.package,
    tier: me.tier,
  };
}

export const pullimApiAuthAdapter: AuthAdapter = {
  async getMe(): Promise<User | null> {
    try {
      const me = await api.get<MeResponse>('/me');
      return mapMe(me);
    } catch (err) {
      // 미인증/만료(401)만 게스트로. 500·네트워크·DTO 오류까지 null로 삼키면
      // 서버 장애 시 사용자가 조용히 로그아웃된 것처럼 보이고 감지도 어렵다 → 전파.
      const e = err as ApiError;
      if (e?.status === 401 || e?.authExpired) return null;
      throw err;
    }
  },

  async signup(input: SignupInput): Promise<SignupResult> {
    // TODO(B): signup-request.dto 필드명 확정(email/password/displayName/birthDate).
    const res = await api.post<{ user: MeResponse; needsEmailVerify: boolean; needsGuardianConsent: boolean }>(
      '/auth/signup',
      input
    );
    return {
      user: mapMe(res.user),
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
    return mapMe(me);
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
