import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  saveSubmittedPayload,
  loadSubmittedPayload,
  clearSubmittedPayload,
} from './submitted-payload';

describe('submitted-payload (fail-closed)', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('저장 성공 시 true + 라운드트립', () => {
    expect(saveSubmittedPayload({ a: 1, consent: { isMinor: false } })).toBe(true);
    expect(loadSubmittedPayload()).toEqual({ a: 1, consent: { isMinor: false } });
  });

  it('저장 전에는 null', () => {
    expect(loadSubmittedPayload()).toBeNull();
  });

  it('clear 후 null', () => {
    saveSubmittedPayload({ a: 1 });
    clearSubmittedPayload();
    expect(loadSubmittedPayload()).toBeNull();
  });

  it('setItem이 조용히 실패하면 false 반환(fail-closed)', () => {
    // 쓰기가 반영되지 않는 환경(프라이빗 모드 등) 모사: setItem no-op.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    expect(saveSubmittedPayload({ a: 1 })).toBe(false);
  });

  it('setItem이 throw하면 false 반환', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    expect(saveSubmittedPayload({ a: 1 })).toBe(false);
  });
});
