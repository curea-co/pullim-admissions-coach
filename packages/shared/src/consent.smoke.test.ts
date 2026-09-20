import { describe, it, expect } from 'vitest';
import { consentSchema } from './schemas';

// 2026-09-20: 필드가 isMinor(만19) → guardianRequired(만14) 로 정정됐다.
// 경위는 apps/web/lib/consent-gate.ts 주석.
describe('consentSchema (러너 동작 확인)', () => {
  it('만 14세 미만은 법정대리인 동의 없으면 실패한다', () => {
    const r = consentSchema.safeParse({
      guardianRequired: true,
      termsAgreed: true,
      privacyPolicyAgreed: true,
      guardianConsentObtained: false,
      consentTimestamp: '2026-06-23T00:00:00.000Z',
    });
    expect(r.success).toBe(false);
  });

  it('필수 동의가 모두 true면 통과한다', () => {
    const r = consentSchema.safeParse({
      guardianRequired: false,
      termsAgreed: true,
      privacyPolicyAgreed: true,
      guardianConsentObtained: false,
      consentTimestamp: '2026-06-23T00:00:00.000Z',
    });
    expect(r.success).toBe(true);
  });
});
