import 'server-only'
import { StudentProfileSchema, type StudentProfile } from '@pullim/shared'
import { resolveCohort, assembleRubric, type Rubric, type CohortResult } from '@pullim/engine'
import { maskPII } from './mask'
import { diagnose } from './ai/diagnose'
import { prescribe } from './ai/prescribe'
import type { Diagnosis } from './ai/schemas'

export interface AnalyzeResult { cohort: CohortResult; diagnosis: Diagnosis; rubric: Rubric }

export async function analyze(raw: unknown): Promise<AnalyzeResult> {
  const parsed = StudentProfileSchema.parse(raw) // 입학연도·동의(sensitive===true) 검증
  if (parsed.grade < 1) throw new Error('학년 오류')
  const profile: StudentProfile = { ...parsed, saengbu: maskPII(parsed.saengbu) }
  const cohort = resolveCohort(profile.admissionYear, profile.targetRegion)
  const diagnosis = await diagnose(profile, cohort)
  const candidates = await prescribe(profile, cohort, diagnosis)
  const rubric = assembleRubric(cohort, candidates)
  return { cohort, diagnosis, rubric } // 영속화 없음 = 무학습/즉시삭제
}
