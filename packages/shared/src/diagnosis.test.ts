import { describe, it, expect } from 'vitest';
import { diagnosisGuideSchema } from './diagnosis';

// 정상 3역량 합성 fixture (park-junho 데모와 별개의 최소 유효값)
const valid = {
  criteria: [
    {
      competency: 'academic',
      summary: '교과 성취와 탐구 기록이 탄탄합니다.',
      highlights: [
        { item: '탐구력', flag: 'strength', evidence: ['세특-정보(자료구조 발표)'], note: '발표로 학습을 확장함.' },
      ],
      nextSteps: '심화 학습을 진로 활동으로 본인이 연결해볼 것.',
    },
    {
      competency: 'career',
      summary: '진로 방향은 분명하나 직접 시도 기록이 더 필요합니다.',
      highlights: [
        { item: '진로 탐색 활동과 경험', flag: 'gap', evidence: ['진로활동-진로탐색 보고서'], note: '본인 주도 프로젝트 기록이 적음.' },
      ],
      nextSteps: '동아리 산출물을 본인이 정리해 시도를 드러낼 것.',
    },
    {
      competency: 'community',
      summary: '협력 경험은 있으나 역할 정리가 더 필요합니다.',
      highlights: [
        { item: '성실성과 규칙준수', flag: 'strength', evidence: ['행특(성실·책임 일관)'], note: '교사 평가가 일관됨.' },
      ],
      nextSteps: '팀 작업에서 본인 역할을 한두 줄로 정리할 것.',
    },
  ],
};

describe('diagnosisGuideSchema', () => {
  it('정상 3역량 구조는 통과한다', () => {
    expect(diagnosisGuideSchema.safeParse(valid).success).toBe(true);
  });

  it('criteria가 3건이 아니면 실패한다', () => {
    const bad = { criteria: valid.criteria.slice(0, 2) };
    expect(diagnosisGuideSchema.safeParse(bad).success).toBe(false);
  });

  it('역량이 중복되면(공동체 누락) 실패한다', () => {
    const bad = { criteria: [valid.criteria[0], valid.criteria[1], { ...valid.criteria[0] }] };
    expect(diagnosisGuideSchema.safeParse(bad).success).toBe(false);
  });

  it('항목이 해당 역량의 평가항목이 아니면 실패한다', () => {
    const bad = structuredClone(valid);
    bad.criteria[0].highlights[0].item = '리더십'; // academic에 community 항목
    expect(diagnosisGuideSchema.safeParse(bad).success).toBe(false);
  });

  it('근거에 섹션 prefix가 없으면 실패한다', () => {
    const bad = structuredClone(valid);
    bad.criteria[0].highlights[0].evidence = ['자료구조 발표']; // prefix 없음
    expect(diagnosisGuideSchema.safeParse(bad).success).toBe(false);
  });

  it('근거가 비어 있으면 실패한다', () => {
    const bad = structuredClone(valid);
    bad.criteria[0].highlights[0].evidence = [];
    expect(diagnosisGuideSchema.safeParse(bad).success).toBe(false);
  });

  it('summary에 등급 라벨(보통)이 있으면 실패한다', () => {
    const bad = structuredClone(valid);
    bad.criteria[0].summary = '학업역량 보통';
    expect(diagnosisGuideSchema.safeParse(bad).success).toBe(false);
  });
});
