import { describe, it, expect } from 'vitest';
import { assembleRubric } from './rubric';
import { resolveCohort } from '@pullim/shared';
import type { ActionCandidate } from '@pullim/shared';

const cand = (recordArea: string): ActionCandidate =>
  ({ recordArea, competency: 'ACADEMIC', text: '미적분 심화 탐구 보고서 작성', rationale: 'r', evidence: { quote: '미적분', section: '세특' } });

describe('assembleRubric', () => {
  const cohort = resolveCohort(2025, 'metro');
  it('합법 후보만 루브릭에 담고 stripped를 기록', () => {
    const r = assembleRubric(cohort, [cand('SETUK'), cand('AWARD')]);
    expect(r.items).toHaveLength(1);
    expect(r.items[0].recordArea).toBe('SETUK');
    expect(r.stripped).toHaveLength(1);
    expect(r.uncertaintyNote).toContain('보장하지 않습니다');
    expect(r.cohort.system).toBe('2028_new');
  });
  it('★골든 합격기준: 루브릭에 금지 영역 0건', () => {
    const r = assembleRubric(cohort, ['SETUK','AWARD','READING','PRIVATE_EDU'].map(cand));
    for (const it of r.items) expect(['SETUK','CREATIVE_REGULAR','BEHAVIOR']).toContain(it.recordArea);
  });
  it('공백뿐인 증거 후보 하나가 전체 루브릭을 throw로 무너뜨리지 않는다', () => {
    const blank: ActionCandidate = { recordArea: 'SETUK', competency: 'ACADEMIC', text: '내용', rationale: 'r', evidence: { quote: '  ', section: '세특' } };
    let r!: ReturnType<typeof assembleRubric>;
    expect(() => { r = assembleRubric(cohort, [blank, cand('SETUK')]); }).not.toThrow();
    expect(r.items).toHaveLength(1);
    expect(r.stripped.some(s => s.reason.includes('증거인용 누락'))).toBe(true);
  });
});
