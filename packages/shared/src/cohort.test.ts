import { describe, it, expect } from 'vitest';
import { resolveCohort, cohortFromGrade } from './cohort';

describe('resolveCohort', () => {
  it('2024 입학 → 2027 구체제(비치헤드)', () => {
    const r = resolveCohort(2024, 'metro');
    expect(r.system).toBe('2027_old');
    expect(r.track).toBe('beachhead');
    expect(r.emphasizeSetuk).toBe(false);
  });
  it('2025 입학 → 2028 신체제(코어, 세특 가중)', () => {
    const r = resolveCohort(2025, 'non_metro');
    expect(r.system).toBe('2028_new');
    expect(r.track).toBe('core');
    expect(r.emphasizeSetuk).toBe(true);
  });
  it('2026 입학 → 2029 신체제(코어)', () => {
    expect(resolveCohort(2026, 'unknown').system).toBe('2029_new');
  });
  it('권역을 보존한다', () => {
    expect(resolveCohort(2024, 'non_metro').region).toBe('non_metro');
  });
});

describe('cohortFromGrade', () => {
  it('고3(2026) → 2027 구체제', () => {
    expect(cohortFromGrade(3, 2026).system).toBe('2027_old');
  });
  it('고2(2026) → 2028 신체제', () => {
    expect(cohortFromGrade(2, 2026).system).toBe('2028_new');
  });
  it('고1(2026) → 2029 신체제', () => {
    expect(cohortFromGrade(1, 2026).system).toBe('2029_new');
  });
  it('2027_old: emphasizeSetuk false', () => {
    expect(cohortFromGrade(3, 2026).emphasizeSetuk).toBe(false);
  });
  it('2028_new: emphasizeSetuk true', () => {
    expect(cohortFromGrade(2, 2026).emphasizeSetuk).toBe(true);
  });
  it('2029_new: emphasizeSetuk true', () => {
    expect(cohortFromGrade(1, 2026).emphasizeSetuk).toBe(true);
  });
});
