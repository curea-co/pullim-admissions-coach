import type { CohortResult, CohortSystem, Region } from './types'

/** 고교 입학연도 → 대입 체제. [D] §7: 2024입학=2027구체제, 2025=2028신체제, 2026+=2029신체제 */
export function resolveCohort(admissionYear: number, region: Region): CohortResult {
  let system: CohortSystem
  if (admissionYear <= 2024) system = '2027_old'
  else if (admissionYear === 2025) system = '2028_new'
  else system = '2029_new'
  const isNew = system !== '2027_old'
  return {
    system,
    track: isNew ? 'core' : 'beachhead',
    region,
    emphasizeSetuk: isNew, // 신체제 내신 5등급제 → 변별력↓ → 세특 정성평가 가중 ([R] §3.2)
  }
}
