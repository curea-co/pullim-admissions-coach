import { describe, it, expect } from 'vitest';
import { requiresGuardianConsent, isConsentGateMet } from './consent-gate';

// 보호자 동의 우회 방지 보안 경계 회귀 고정(Codex #65).
//
// 2026-09-20 정정: 축이 만19(`isMinor`) → 만14(`ageBand`)로 바뀌었다. 근거 없이 굳은 숫자였다
// (경위는 consent-gate.ts 주석). 여기서 **만 16세가 통과하는지**를 명시적으로 고정한다 —
// 주 사용자인 고1~고3 이 전부 만 16~18 이라, 축이 잘못 되돌아가면 이 한 줄에서 먼저 걸린다.

describe('requiresGuardianConsent — 만14 경계, 미확정은 보수적으로 필요', () => {
  it("'over14' → false(만 14세 이상은 본인 동의)", () => {
    expect(requiresGuardianConsent('over14')).toBe(false);
  });
  it("'under14' → true(법정대리인 동의 필요)", () => {
    expect(requiresGuardianConsent('under14')).toBe(true);
  });
  it("'unknown'(권위 소스 미연결) → true — 미확정을 면제로 두면 우회가 뚫린다", () => {
    expect(requiresGuardianConsent('unknown')).toBe(true);
  });
  it('undefined(미인증·미확정) → true', () => {
    expect(requiresGuardianConsent(undefined)).toBe(true);
  });
});

describe('isConsentGateMet — 만14 미만만 보호자 동의 필수', () => {
  it('만 14세 이상: 약관+개인정보만으로 진행', () => {
    expect(
      isConsentGateMet({ guardianRequired: false, terms: true, privacy: true, guardian: false })
    ).toBe(true);
  });
  it('고1~고3(만 16~18)은 over14 → 보호자 동의 없이 통과한다', () => {
    expect(
      isConsentGateMet({
        guardianRequired: requiresGuardianConsent('over14'),
        terms: true,
        privacy: true,
        guardian: false,
      })
    ).toBe(true);
  });
  it('만 14세 미만: 보호자 동의 없으면 차단', () => {
    expect(
      isConsentGateMet({ guardianRequired: true, terms: true, privacy: true, guardian: false })
    ).toBe(false);
  });
  it('만 14세 미만: 3종 모두 동의 시 진행', () => {
    expect(
      isConsentGateMet({ guardianRequired: true, terms: true, privacy: true, guardian: true })
    ).toBe(true);
  });
  it('약관/개인정보 누락 시 차단(연령 무관)', () => {
    expect(
      isConsentGateMet({ guardianRequired: false, terms: false, privacy: true, guardian: true })
    ).toBe(false);
    expect(
      isConsentGateMet({ guardianRequired: true, terms: true, privacy: false, guardian: true })
    ).toBe(false);
  });
});
