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

// /submit 의 stub consent 가 스키마와 어긋나 모든 제출이 막힌 적이 있다(만14 리네임 누락).
// 그때 화면에 뜬 건 "1개 항목을 확인해주세요. (입력 항목)" 뿐이었고, 어느 칸이 문제인지
// 표시되지 않았다 — 라벨도 data-field-error 앵커도 없는 키였기 때문이다.
// 컴파일 차원의 방어는 submit/page.tsx 의 `satisfies Consent` 가 한다. 여기서는 그래도
// 사용자에게 뜻이 통하는 문구가 나가는지를 고정한다.
describe('fieldLabel — consent 경로', () => {
  it('consent 하위 키는 "동의 정보" 로 떨어진다(“입력 항목” 아님)', () => {
    expect(fieldLabel('consent.guardianRequired')).toBe('동의 정보');
    expect(fieldLabel('consent.termsAgreed')).toBe('동의 정보');
  });
});
