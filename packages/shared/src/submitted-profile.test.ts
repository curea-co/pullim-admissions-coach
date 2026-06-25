import { describe, it, expect } from 'vitest';
import { submittedProfileSchema, formatStandingLabel, type SubmittedProfile } from './submitted-profile';

const valid = {
  grade: 3,
  semester: 2,
  schoolType: 'general',
  targetTrack: 'humanities',
  targetUniversities: [],
};

describe('submittedProfileSchema', () => {
  it('정상 프로필 통과', () =>
    expect(submittedProfileSchema.safeParse(valid).success).toBe(true));
  it('잘못된 계열 enum 실패', () =>
    expect(submittedProfileSchema.safeParse({ ...valid, targetTrack: 'xxx' }).success).toBe(false));
  it('학년 누락 실패', () => {
    const { grade, ...rest } = valid;
    expect(submittedProfileSchema.safeParse(rest).success).toBe(false);
  });
  it('목표대학 4개 초과 실패', () =>
    expect(
      submittedProfileSchema.safeParse({
        ...valid,
        targetUniversities: [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }],
      }).success
    ).toBe(false));
});

describe('formatStandingLabel', () => {
  it('인문·일반고', () =>
    expect(formatStandingLabel(valid as SubmittedProfile)).toBe('고3 2학기 · 일반고 · 인문'));
  it('이공·특목고', () =>
    expect(
      formatStandingLabel({
        ...valid,
        schoolType: 'special_purpose',
        targetTrack: 'science_engineering',
      } as SubmittedProfile)
    ).toBe('고3 2학기 · 특목고 · 이공'));
  it('무전공(undeclared) 라벨 포함', () =>
    expect(
      formatStandingLabel({
        ...valid,
        targetTrack: 'undeclared',
      } as SubmittedProfile)
    ).toMatch(/무전공\(전공자율\)/));
});
