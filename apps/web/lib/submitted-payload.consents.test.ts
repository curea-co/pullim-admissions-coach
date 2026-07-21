import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  saveSubmittedPayload,
  loadSubmittedPayload,
  mergeConsentIntoPayload,
} from './submitted-payload';

// ConsentPage.handleProceed 가 사용하는 병합 규칙(record 보존 + consent 덮어쓰기)을
// 프로덕션과 동일한 함수(mergeConsentIntoPayload)로 검증한다. 테스트 안에서 병합을
// 재구현하면 프로덕션 병합이 회귀해도 통과하므로, 실제 호출 함수를 직접 고정한다.
describe('mergeConsentIntoPayload — record 보존 + consent 덮어쓰기', () => {
  const record = { inputType: 'text_paste', text: '생기부', maskingApplied: true };
  const stubConsent = {
    isMinor: true,
    termsAgreed: true,
    privacyPolicyAgreed: true,
    guardianConsentObtained: true,
    consentTimestamp: '2026-01-01T00:00:00.000Z',
  };
  const realConsent = {
    isMinor: false,
    termsAgreed: true,
    privacyPolicyAgreed: true,
    guardianConsentObtained: false,
    consentTimestamp: '2026-01-02T00:00:00.000Z',
  };

  it('기존 record는 유지하고 consent만 실제 동의값으로 덮어쓴다', () => {
    const existing = { schemaVersion: '1.0.0', record, consent: stubConsent };
    const merged = mergeConsentIntoPayload(existing, realConsent);

    expect(merged.record).toEqual(record); // record 보존
    expect(merged.consent).toEqual(realConsent); // consent 덮어쓰기
    expect(merged.schemaVersion).toBe('1.0.0'); // 그 외 필드 유지
  });

  it('원본 객체를 변형하지 않는다(불변)', () => {
    const existing = { record, consent: stubConsent };
    mergeConsentIntoPayload(existing, realConsent);
    expect(existing.consent).toEqual(stubConsent);
  });

  it('existing 이 비-객체(null 등)여도 consent 만 담긴 객체를 만든다', () => {
    expect(mergeConsentIntoPayload(null, realConsent)).toEqual({ consent: realConsent });
    expect(mergeConsentIntoPayload(undefined, realConsent)).toEqual({ consent: realConsent });
  });
});

describe('submitted-payload 저장 라운드트립', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('병합 결과를 저장/로드해도 동일하게 복원된다', () => {
    const existing = {
      schemaVersion: '1.0.0',
      record: { inputType: 'text_paste', text: '생기부' },
      consent: { isMinor: true, termsAgreed: true },
    };
    expect(saveSubmittedPayload(existing)).toBe(true);

    const merged = mergeConsentIntoPayload(loadSubmittedPayload(), {
      isMinor: false,
      termsAgreed: true,
      privacyPolicyAgreed: true,
      guardianConsentObtained: false,
      consentTimestamp: '2026-01-02T00:00:00.000Z',
    });
    expect(saveSubmittedPayload(merged)).toBe(true);
    expect(loadSubmittedPayload()).toEqual(merged);
  });
});
