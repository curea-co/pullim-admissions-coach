import { filterActions } from '@pullim/shared';
import type { ActionCandidate, CohortResult } from '@pullim/shared';
import { assertCited, buildUncertaintyNote } from './evidence';
import type { Rubric } from './types';

/** LLM 처방 후보 → §6.2 게이트 → 증거 보증 → 코호트-인식 합법 루브릭. */
export function assembleRubric(cohort: CohortResult, candidates: ActionCandidate[]): Rubric {
  const { passed, stripped } = filterActions(candidates);
  assertCited(passed); // 통과분은 게이트가 증거 보증하므로 항상 성립(이중 안전)
  return { cohort, items: passed, uncertaintyNote: buildUncertaintyNote(), stripped };
}
