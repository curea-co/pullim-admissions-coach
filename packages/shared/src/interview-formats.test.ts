import { describe, it, expect } from 'vitest';
import {
  lookupInterviewFormats,
  INTERVIEW_FORMAT_LABEL,
  UNIVERSITY_INTERVIEW_FORMATS,
} from './interview-formats';

describe('lookupInterviewFormats', () => {
  it('medical 계열은 미매칭이어도 mmi 기본 포함', () => {
    const f = lookupInterviewFormats([{ name: '무명대학교' }], 'medical');
    expect(f).toContain('record_based');
    expect(f).toContain('mmi');
  });
  it('비의대·미매칭은 학생부 기반만', () => {
    expect(lookupInterviewFormats([{ name: '무명대학교' }], 'humanities')).toEqual(['record_based']);
  });
  it('대학 미입력은 계열 기본값', () => {
    expect(lookupInterviewFormats([], 'science_engineering')).toEqual(['record_based']);
  });
  it('서울대학교는 제시문 기반 포함', () => {
    const f = lookupInterviewFormats([{ name: '서울대학교' }], 'humanities');
    expect(f).toContain('passage_based');
  });
  it('공백 정규화 매칭(서울 대학교)', () => {
    const f = lookupInterviewFormats([{ name: '서울 대학교' }], 'humanities');
    expect(f).toContain('passage_based');
  });
  it('중복 제거', () => {
    const f = lookupInterviewFormats([{ name: '서울대학교' }, { name: '서울대학교' }], 'humanities');
    expect(new Set(f).size).toBe(f.length);
  });
});

describe('데이터셋·라벨', () => {
  it('라벨 3종', () => {
    expect(INTERVIEW_FORMAT_LABEL.record_based).toBe('학생부 기반');
    expect(INTERVIEW_FORMAT_LABEL.passage_based).toBe('제시문 기반');
    expect(INTERVIEW_FORMAT_LABEL.mmi).toBe('의대 MMI');
  });
  it('모든 데이터셋 항목은 비어있지 않은 formats', () => {
    for (const [, v] of Object.entries(UNIVERSITY_INTERVIEW_FORMATS)) {
      expect(v.formats.length).toBeGreaterThan(0);
    }
  });
});
