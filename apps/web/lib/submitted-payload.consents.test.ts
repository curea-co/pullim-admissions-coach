import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { saveSubmittedPayload, loadSubmittedPayload } from './submitted-payload';

describe('submitted-payload consent merge', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('이전 제출 payload에 권위값 기반 consent를 덮어써도 기존 record는 유지한다', () => {
    const existing = {
      schemaVersion: '1.0.0',
      record: { inputType: 'text_paste', text: '생기부', maskingApplied: true },
      consent: { isMinor: true, termsAgreed: true, privacyPolicyAgreed: true, guardianConsentObtained: true, consentTimestamp: '2026-01-01T00:00:00.000Z' },
    };

    expect(saveSubmittedPayload(existing)).toBe(true);

    const merged = {
      ...(loadSubmittedPayload() as Record<string, unknown>),
      consent: {
        isMinor: false,
        termsAgreed: true,
        privacyPolicyAgreed: true,
        guardianConsentObtained: false,
        consentTimestamp: '2026-01-02T00:00:00.000Z',
      },
    };

    expect(saveSubmittedPayload(merged)).toBe(true);
    expect(loadSubmittedPayload()).toEqual(merged);
    expect((loadSubmittedPayload() as Record<string, unknown>).record).toEqual(existing.record);
  });
});
