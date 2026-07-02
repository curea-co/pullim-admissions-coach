import { describe, it, expect } from 'vitest';
import { toAnalyzeResult, type DiagnosisDto } from './admissions-api';

// 상태 전이 어댑터 회귀 고정 — done 외 상태(pending/processing/failed)가 결과 본문으로
// 오인 렌더되지 않도록(null 반환 → 호출부가 명시 분기). PR #55 리뷰 지적 케이스.

const doneBody = {
  interview: { questions: [] },
  diagnosis: { criteria: [] },
  improvements: {
    cohort: {
      system: '2028_new',
      track: 'core',
      region: 'unknown',
      emphasizeSetuk: true,
    },
    items: [],
    uncertaintyNote: '합격 여부를 보장하지 않습니다.',
    stripped: [],
  },
  roadmap: null,
  fit: null,
} as unknown as Pick<
  DiagnosisDto,
  'interview' | 'diagnosis' | 'improvements' | 'roadmap' | 'fit'
>;

function dto(status: DiagnosisDto['status'], body = doneBody): DiagnosisDto {
  return {
    id: 'dx-1',
    submissionId: 'sub-1',
    status,
    createdAt: '2026-07-02T00:00:00Z',
    ...body,
  };
}

describe('toAnalyzeResult — 상태 전이', () => {
  it('done + 본문 → AnalyzeResult(improvements→rubric 복원, cohort 재수화)', () => {
    const r = toAnalyzeResult(dto('done'));
    expect(r).not.toBeNull();
    expect(r!.rubric.uncertaintyNote).toContain('보장하지 않습니다');
    expect(r!.cohort.system).toBe('2028_new');
  });

  it.each(['pending', 'processing', 'failed'] as const)(
    '%s → null(데모로 가리지 않고 호출부가 명시 분기)',
    (status) => {
      expect(toAnalyzeResult(dto(status))).toBeNull();
    }
  );

  it('done 이지만 본문 누락(부분 영속) → null(불완전 결과 렌더 차단)', () => {
    const broken = dto('done');
    broken.diagnosis = null;
    expect(toAnalyzeResult(broken)).toBeNull();
  });
});
