import { describe, expect, it } from 'vitest';
import { fieldLabel } from './validation';

describe('fieldLabel', () => {
  it('정확한 스키마 키를 한국어 라벨로 치환한다', () => {
    expect(fieldLabel('record.maskingApplied')).toBe('개인정보 마스킹 확인');
    expect(fieldLabel('selfReportedWeakAreas')).toBe('보완이 필요한 영역');
  });

  it('배열 경로를 최상위 키로 폴백해 라벨을 찾는다', () => {
    expect(fieldLabel('targetUniversities.0.name')).toBe('목표 대학');
    expect(fieldLabel('currentStanding.grade')).toBe('학년');
  });

  it('알 수 없는 키는 기본값으로 노출한다', () => {
    expect(fieldLabel('unknown.field')).toBe('입력 항목');
  });
});
