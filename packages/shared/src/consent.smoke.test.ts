import { describe, it, expect } from 'vitest';
import { consentSchema } from './schemas';

describe('consentSchema (러너 동작 확인)', () => {
  it('미성년자는 법정대리인 동의 없으면 실패한다', () => {
    const r = consentSchema.safeParse({
      isMinor: true, termsAgreed: true, privacyPolicyAgreed: true,
      guardianConsentObtained: false, consentTimestamp: '2026-06-23T00:00:00.000Z',
    });
    expect(r.success).toBe(false);
  });
  it('필수 동의가 모두 true면 통과한다', () => {
    const r = consentSchema.safeParse({
      isMinor: false, termsAgreed: true, privacyPolicyAgreed: true,
      guardianConsentObtained: false, consentTimestamp: '2026-06-23T00:00:00.000Z',
    });
    expect(r.success).toBe(true);
  });
});
