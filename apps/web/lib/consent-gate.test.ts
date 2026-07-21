import { describe, it, expect } from 'vitest';
import { resolveIsMinor, isConsentGateMet } from './consent-gate';

// 보호자 동의 우회 방지 보안 경계 회귀 고정(Codex #65).
describe('resolveIsMinor — 미확정 시 보수적 미성년', () => {
  it('undefined → true(보수적 미성년, 보호자 동의 우회 차단)', () => {
    expect(resolveIsMinor(undefined)).toBe(true);
  });
  it('false → false(성인)', () => {
    expect(resolveIsMinor(false)).toBe(false);
  });
  it('true → true(미성년)', () => {
    expect(resolveIsMinor(true)).toBe(true);
  });
});

describe('isConsentGateMet — 미성년=보호자 동의 필수, 성인=면제', () => {
  it('성인: 약관+개인정보만으로 진행(보호자 동의 없이 통과)', () => {
    expect(isConsentGateMet({ isMinor: false, terms: true, privacy: true, guardian: false })).toBe(true);
  });
  it('미성년: 보호자 동의 없으면 차단', () => {
    expect(isConsentGateMet({ isMinor: true, terms: true, privacy: true, guardian: false })).toBe(false);
  });
  it('미성년: 3종 모두 동의 시 진행', () => {
    expect(isConsentGateMet({ isMinor: true, terms: true, privacy: true, guardian: true })).toBe(true);
  });
  it('약관/개인정보 누락 시 차단(성인·미성년 공통)', () => {
    expect(isConsentGateMet({ isMinor: false, terms: false, privacy: true, guardian: true })).toBe(false);
    expect(isConsentGateMet({ isMinor: true, terms: true, privacy: false, guardian: true })).toBe(false);
  });
});
