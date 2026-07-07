import { describe, it, expect } from 'vitest';
import { decideAccessOnError } from './admissions-access-state';
import type { ApiError } from './api';

const err = (extra: Partial<ApiError>): ApiError =>
  Object.assign(new Error('x'), { status: 0, ...extra }) as ApiError;

describe('decideAccessOnError — 게이트 401 재검증 분기(Codex #59)', () => {
  it('401 + 재시도 잔여(0) → retry(세션 갱신 후 1회 재검증)', () => {
    expect(decideAccessOnError(err({ status: 401 }), 0)).toBe('retry');
    expect(decideAccessOnError(err({ status: 401, authExpired: true }), 0)).toBe('retry');
  });

  it('401 + 재시도 소진(≥1) → error(무한 루프 방지)', () => {
    expect(decideAccessOnError(err({ status: 401, authExpired: true }), 1)).toBe('error');
    expect(decideAccessOnError(err({ status: 401 }), 2)).toBe('error');
  });

  it('401 아님(5xx/네트워크) → error', () => {
    expect(decideAccessOnError(err({ status: 500 }), 0)).toBe('error');
    expect(decideAccessOnError(err({ status: 0 }), 0)).toBe('error');
    expect(decideAccessOnError(undefined, 0)).toBe('error');
  });
});
