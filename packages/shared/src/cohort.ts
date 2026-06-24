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
 */
export function cohortFromGrade(grade: number, currentYear: number = new Date().getFullYear()): CohortResult {
  return resolveCohort(currentYear - (grade - 1), 'unknown');
}
