// 동의 게이트 — 보호자 동의 우회 방지 보안 경계(#52·#65). React 무관 순수 함수로 분리해 단위 테스트.
//
// ── 연령 기준 정정(2026-09-20) ────────────────────────────────────────────────
// 이 게이트는 **만 14세**(개인정보 동의 경계)를 쓴다. 이전에는 `user.isMinor`(만 19세 미만,
// 민법상 미성년)로 판정했는데, 그 숫자에는 근거가 없었다.
//
// 추적 결과: 정의 v0.3 §6.3(2026-05-26)은 "미성년자(**만 14세 미만 포함 가능성**) 법정대리인
// 동의 절차를 출시 전 확정"이라고 유보했고, docs/006 §8-1 도 "만 14세 미만 포함"이다. 사흘 뒤
// docs/007 §1(2026-05-29)이 "미성년자(만 19세 미만) … 법정대리인 동의 필수"로 단정하면서 근거를
// "정의 §6.3 / 정책 §6"으로 달았는데, **두 곳 어디에도 19가 없다**(정책 §6 은 접근 통제 절이다).
// 한 달 뒤 `isMinorByBirth`(만19)가 코드에 들어오며 그대로 굳었다. 정책 결정이 아니라 "미성년자"
// 라는 낱말에 민법 성년 연령을 대입한 **오기**였다.
//
// 그래서 축을 `ageBand`(만14, auth `/me` 가 birth_date 복호로 산정하는 권위값)로 되돌린다.
// `user.isMinor`(만19)는 그대로 남는다 — 민법상 미성년 여부는 사실이고 마이페이지 배지가 쓴다.
// 다만 **법정대리인 동의를 가르는 축이 아니다.**

import type { AgeBand } from '@/lib/auth/types';

/**
 * 법정대리인 동의가 필요한가 — 만 14세 미만이면 필요하다.
 *
 * `ageBand` 가 `'unknown'`(권위 소스 미연결)이거나 `undefined`(미인증·미확정)이면 **보수적으로
 * 필요**로 본다. 미확정을 면제로 처리하면 만 14세 미만이 동의를 우회할 수 있다(#52 와 같은 이유).
 */
export function requiresGuardianConsent(ageBand: AgeBand | undefined): boolean {
  return ageBand !== 'over14';
}

export interface ConsentGateState {
  /** {@link requiresGuardianConsent} 결과. 화면 자기신고가 아니라 권위값에서만 온다. */
  guardianRequired: boolean;
  terms: boolean;
  privacy: boolean;
  guardian: boolean;
}

/**
 * 다음 단계 진행 가능 여부 — 약관·개인정보는 항상 필수, **만 14세 미만이면 법정대리인 동의도 필수**.
 */
export function isConsentGateMet(s: ConsentGateState): boolean {
  if (!s.terms || !s.privacy) return false;
  if (s.guardianRequired && !s.guardian) return false;
  return true;
}
