/**
 * @pullim/engine — type definitions.
 *
 * cohort + legality 타입은 @pullim/shared 단일 소스 — 여기서 재정의 금지.
 * 엔진 고유 타입만 정의한다.
 */

// cohort 타입 re-export (shared 단일소스)
export type { CohortSystem, Track, Region, CohortResult } from '@pullim/shared';
export { resolveCohort, cohortFromGrade } from '@pullim/shared';

// legality 타입 re-export (shared 단일소스)
export type {
  AllowedRecordArea,
  EvidenceRef,
  ActionCandidate,
  PrescribedAction,
  LegalityResult,
} from '@pullim/shared';
export {
  ALLOWED_RECORD_AREAS,
  FORBIDDEN_RECORD_AREAS,
  FORBIDDEN_KEYWORDS,
  filterActions,
} from '@pullim/shared';

/**
 * 엔진 표기 역량(대문자). shared의 Competency(소문자)와 구분됨.
 * criteria.ts 등 엔진 모듈에서 사용하는 uppercase 역량 식별자.
 */
export type Competency = 'ACADEMIC' | 'CAREER' | 'COMMUNITY';

/**
 * 루브릭: 코호트 + 합법 처방 목록 + 불확실성 안내 + 제거 목록.
 * assembleRubric 출력.
 */
export interface Rubric {
  cohort: import('@pullim/shared').CohortResult;
  items: import('@pullim/shared').PrescribedAction[];
  uncertaintyNote: string;
  stripped: { recordArea: string; reason: string }[];
}
