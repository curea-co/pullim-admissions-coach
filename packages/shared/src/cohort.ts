// #16(sales-ceo 폐쇄루프 revamp)에서 흡수 — 학년별 대입 체제(코호트) 판정.
// 미래 진단 파이프라인에서 입학연도→제도 분기에 사용. (이슈 #24 학년별 2028 제도)

export type CohortSystem = '2027_old' | '2028_new' | '2029_new';
export type Track = 'beachhead' | 'core';
export type Region = 'metro' | 'non_metro' | 'unknown';

export interface CohortResult {
  system: CohortSystem;
  track: Track;
  region: Region;
  /** 신체제 정성평가 가중(세특 우선) 여부 */
  emphasizeSetuk: boolean;
}

/**
 * 고교 입학연도 → 대입 체제.
 * 2024 입학 = 2027 구체제, 2025 입학 = 2028 신체제, 2026+ 입학 = 2029 신체제.
 * 신체제는 내신 5등급제로 변별력이 낮아 세특(정성평가) 가중.
 */
export function resolveCohort(admissionYear: number, region: Region): CohortResult {
  let system: CohortSystem;
  if (admissionYear <= 2024) system = '2027_old';
  else if (admissionYear === 2025) system = '2028_new';
  else system = '2029_new';
  const isNew = system !== '2027_old';
  return {
    system,
    track: isNew ? 'core' : 'beachhead',
    region,
    emphasizeSetuk: isNew,
  };
}

/**
 * 현재 학년(1=고1, 2=고2, 3=고3) → 대입 체제.
 * 고등학교 1학년 기준 입학연도는 currentYear - (grade - 1).
 *
 * @param grade      현재 학년 (1=고1, 2=고2, 3=고3)
 * @param currentYear 기준 연도 (기본값: 실행 시점 연도)
 *
 * @remarks
 * **제한사항 — region / track 필드는 placeholder 값입니다.**
 * 이 함수는 `region: 'unknown'`을 고정으로 넘기므로 반환된
 * `CohortResult.region`은 항상 `'unknown'`이고,
 * `track`은 실제 지역 데이터가 아닌 신/구체제 여부만으로 결정됩니다.
 * (`isNew === true` → `'core'`, `false` → `'beachhead'`는 의미론적으로
 * 지역 기반 판단이 아닌 임시 값입니다.)
 *
 * UI 표시처럼 `system` · `emphasizeSetuk`만 사용하는 호출자에게는 안전합니다.
 * 그러나 지역 민감 AI 파이프라인(처방/적합성 분기 등)에서 `region`이나
 * `track`을 소비할 경우, 반드시 `resolveCohort(admissionYear, actualRegion)`을
 * 직접 호출하여 실제 region을 전달해야 합니다.
 *
 * TODO: 실제 region을 알 수 있는 호출 경로에서는 `resolveCohort`를 직접 사용하거나
 * 이 함수에 `region` 파라미터를 추가(기본값 `'unknown'`)하여 스레드를 완성할 것.
 */
export function cohortFromGrade(grade: number, currentYear: number = new Date().getFullYear()): CohortResult {
  return resolveCohort(currentYear - (grade - 1), 'unknown');
}
