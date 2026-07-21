// 동의 게이트 — 보호자 동의 우회 방지 보안 경계(#52·#65). React 무관 순수 함수로 분리해 단위 테스트.

/**
 * 미성년 여부 확정 — auth `user.isMinor`가 미확정(undefined)이면 **보수적으로 미성년** 처리한다.
 * (미확정을 성인으로 보면 미성년자가 법정대리인 동의를 우회할 수 있으므로.)
 */
export function resolveIsMinor(userIsMinor: boolean | undefined): boolean {
  return userIsMinor ?? true;
}

export interface ConsentGateState {
  isMinor: boolean;
  terms: boolean;
  privacy: boolean;
  guardian: boolean;
}

/**
 * 다음 단계 진행 가능 여부 — 약관·개인정보는 항상 필수, **미성년이면 법정대리인 동의도 필수**(성인은 면제).
 */
export function isConsentGateMet(s: ConsentGateState): boolean {
  if (!s.terms || !s.privacy) return false;
  if (s.isMinor && !s.guardian) return false;
  return true;
}
