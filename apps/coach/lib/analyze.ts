import 'server-only'
import { StudentProfileSchema, type StudentProfile } from '@pullim/shared'
import {
  resolveCohort,
  assembleRubric,
  diffSnapshots,
  buildRoadmap,
  type Rubric,
  type CohortResult,
  type TwinDiff,
  type ActionOutcome,
  type Roadmap,
} from '@pullim/engine'
import { maskPII } from './mask'
import { diagnose } from './ai/diagnose'
import { prescribe } from './ai/prescribe'
import { interviewPack } from './ai/interview'
import { assessFit, type FitAssessment } from './fit'
import { toSnapshot } from './twin'
import { judgeLanded } from './ai/twin-judge'
import type { Diagnosis, InterviewPack } from './ai/schemas'

export interface AnalyzeResult {
  cohort: CohortResult
  diagnosis: Diagnosis
  rubric: Rubric
  /** 종단 트윈(선택) — priorSaengbu가 있을 때만 채워진다(결정론적 baseline + LLM judge 병합). */
  twin?: TwinDiff
  /** 입시 로드맵(결정론) — cohort+학년 기반 학종 타임라인. */
  roadmap?: Roadmap
  /** 정성 적합도(결정론, no LLM) — 합격%·점수 없음. */
  fit?: FitAssessment
  /** 면접 준비 팩(1 LLM call) — 답변 방향만, 근거 인용 기반. */
  interview?: InterviewPack
}

/**
 * 한 학기 진단→처방→루브릭 조립. priorSaengbu 유무와 무관한 공통 단계.
 * cohort는 외부에서 1회 산출해 주입한다(두 학기 동일 코호트).
 */
async function diagnosePrescribe(
  profile: StudentProfile,
  cohort: CohortResult,
  withIdentity: boolean,
): Promise<AnalyzeResult> {
  const diagnosis = await diagnose(profile, cohort)
  const candidates = await prescribe(profile, cohort, diagnosis)
  const rubric = assembleRubric(cohort, candidates)
  if (!withIdentity) {
    // 종단 트윈의 "이전 학기" 재구성에는 identity 산출물을 붙이지 않는다(불필요한 LLM 호출 회피).
    return { cohort, diagnosis, rubric }
  }
  // ── 입시 코치 identity 산출물(현재 학기에만 부착).
  // 로드맵·적합도는 결정론(저렴). 면접 팩만 1 LLM 호출 추가.
  const roadmap = buildRoadmap(cohort, profile.grade)
  const fit = assessFit(profile.track5, diagnosis)
  const interview = await interviewPack(profile, cohort, diagnosis)
  return { cohort, diagnosis, rubric, roadmap, fit, interview }
}

export async function analyze(raw: unknown): Promise<AnalyzeResult> {
  const parsed = StudentProfileSchema.parse(raw) // 입학연도·동의(sensitive===true) 검증
  if (parsed.grade < 1) throw new Error('학년 오류')

  // 마스킹은 모든 LLM 호출 전에. (priorSaengbu도 LLM에 닿기 전 마스킹)
  const maskedSaengbu = maskPII(parsed.saengbu)
  const profile: StudentProfile = { ...parsed, saengbu: maskedSaengbu }
  const cohort = resolveCohort(profile.admissionYear, profile.targetRegion)

  // ── 단일 학기 경로(기존과 100% 동일): twin은 undefined로 둔다.
  const current = await diagnosePrescribe(profile, cohort, true)
  if (!parsed.priorSaengbu) {
    return current // 영속화 없음 = 무학습/즉시삭제
  }

  // ── 종단 트윈 경로(두 학기, 한 요청, 영속화 없음).
  const priorTerm = parsed.priorTerm ?? '이전 학기'
  const currentTerm = parsed.currentTerm ?? '이번 학기'

  // 이전 학기 생기부도 LLM에 닿기 전 마스킹.
  const priorMaskedSaengbu = maskPII(parsed.priorSaengbu)
  const priorProfile: StudentProfile = { ...profile, saengbu: priorMaskedSaengbu }

  // 이전 학기: 그때 "냈을" 처방.
  const prior = await diagnosePrescribe(priorProfile, cohort, false)

  const prevSnapshot = toSnapshot(priorTerm, prior)
  const nextSnapshot = toSnapshot(currentTerm, current)

  // 결정론적 baseline.
  const det = diffSnapshots(prevSnapshot, nextSnapshot)
  // LLM judge(현재 마스킹 생기부 위에서 의미적 안착 판정).
  const judge = await judgeLanded(prevSnapshot.actions, nextSnapshot.evidence, maskedSaengbu)

  const byIndex = new Map(judge.outcomes.map((o) => [o.index, o]))

  // 병합: det가 landed거나 judge가 landed면 landed. landed면 judge.matchedQuote 우선, 없으면 det.matchedQuote.
  const outcomes: ActionOutcome[] = det.outcomes.map((d, i) => {
    const j = byIndex.get(i)
    const judgeLandedHere = j?.landed === true
    const landed = d.status === 'landed' || judgeLandedHere
    const matchedQuote = !landed
      ? null
      : judgeLandedHere && j?.matchedQuote
        ? j.matchedQuote
        : d.matchedQuote
    return { action: d.action, status: landed ? 'landed' : 'pending', matchedQuote, score: d.score }
  })

  // summary 재계산(det.newEvidence는 유지).
  const landed = outcomes.filter((o) => o.status === 'landed').length
  const pending = outcomes.length - landed
  const landedRate = Math.round((landed / Math.max(1, prevSnapshot.actions.length)) * 100) / 100

  const twin: TwinDiff = {
    from: det.from,
    to: det.to,
    outcomes,
    newEvidence: det.newEvidence,
    summary: { landed, pending, landedRate, newEvidence: det.newEvidence.length },
  }

  return { ...current, twin }
}
