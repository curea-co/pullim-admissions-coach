import {
  criteriaForTrack,
  matchUniversity,
  SOURCE_CAVEAT,
  UNIVERSITY_WEIGHT_CAVEAT,
  type TrackKey,
  type Competency,
} from '@pullim/engine'
import type { Diagnosis } from './ai/schemas'

/**
 * 정성 적합도(전형 fit) — PURE / DETERMINISTIC / no LLM.
 *
 * ★ 정직성 (비협상):
 * - 합격 가능성·점수·% 절대 금지. 역량별 정성 수준(강함/적정/보완필요)만.
 * - criteriaForTrack(track)의 valuedCompetencies vs 진단 근거를 결합해 결정론적으로 판정.
 * - SOURCE_CAVEAT를 항상 동봉. 데이터에 없는 사실을 날조하지 않는다.
 *
 * 판정 규칙(결정론):
 * - 해당 역량에 진단 근거(evidence)가 2개 이상 + 강점 서술이 있으면 → '강함'
 * - 진단 근거(evidence)가 1개 이상 있으면 → '적정'
 * - 진단 근거가 없으면 → '보완필요'
 */
export interface FitAssessment {
  track: TrackKey
  label: string
  recommendedSubjects: string[]
  competencyFit: {
    key: Competency
    level: '강함' | '적정' | '보완필요'
    reason: string
  }[]
  consistencyNote: string
  caveat: string
  /** 목표 대학별 평가기준(입력 시에만) — KB 검증 데이터 or 미수록 정직 폴백. */
  universityFit?: UniversityFitNote[]
}

/**
 * 목표 대학 1곳에 대한 평가기준 노트.
 * matched=true 필드는 전부 엔진 KB의 검증(verified) 데이터 그대로이며,
 * matched=false면 사실 필드 없이 미수록 안내만 담는다 — 날조 금지.
 */
export interface UniversityFitNote {
  /** 사용자가 입력한 이름 */
  input: string
  matched: boolean
  /** KB 정식 명칭(매칭 시) */
  name?: string
  evaluationFraming?: string
  evaluationItems?: string[]
  recommendedNote?: string
  source?: string
  /** 매칭 시 가중치 caveat, 미수록 시 모집요강 확인 안내 */
  note: string
}

const KEY_LABEL: Record<Competency, string> = {
  ACADEMIC: '학업역량',
  CAREER: '진로역량',
  COMMUNITY: '공동체역량',
}

/** 목표 대학 입력 → 대학별 노트(중복 제거·최대 3). 미수록은 정직 폴백. */
function assessUniversities(inputs: string[], trackLabel: string): UniversityFitNote[] {
  const notes: UniversityFitNote[] = []
  const seen = new Set<string>()
  for (const input of inputs) {
    const trimmed = input.trim()
    if (!trimmed) continue
    const kb = matchUniversity(trimmed)
    const dedupeKey = kb ? `kb:${kb.id}` : `raw:${trimmed.replace(/\s+/g, '')}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    if (kb) {
      notes.push({
        input: trimmed,
        matched: true,
        name: kb.name,
        evaluationFraming: kb.evaluationFraming,
        evaluationItems: kb.evaluationItems,
        recommendedNote: kb.recommendedNote,
        source: kb.source,
        note: UNIVERSITY_WEIGHT_CAVEAT,
      })
    } else {
      notes.push({
        input: trimmed,
        matched: false,
        note: `'${trimmed}'의 평가기준은 아직 수록되지 않았습니다. ${trackLabel} 일반 기준으로 진단했으니, 정확한 평가요소·전형 방식은 해당 대학 모집요강을 직접 확인하세요.`,
      })
    }
    if (notes.length >= 3) break
  }
  return notes
}

export function assessFit(
  track: TrackKey,
  diagnosis: Diagnosis,
  targetUniversities?: string[],
): FitAssessment {
  const criteria = criteriaForTrack(track)
  const byKey = new Map(diagnosis.criteria.map((c) => [c.key, c]))

  const competencyFit = criteria.valuedCompetencies.map((key) => {
    const d = byKey.get(key)
    const evidenceCount = d?.evidence.length ?? 0
    const hasStrength = !!d?.strength?.trim()
    const label = KEY_LABEL[key]

    let level: '강함' | '적정' | '보완필요'
    let reason: string
    if (evidenceCount >= 2 && hasStrength) {
      level = '강함'
      reason = `${label}: 생기부 근거 ${evidenceCount}건과 강점 서술이 확인되어 ${criteria.label}에서 부각되는 역량과 잘 맞습니다.`
    } else if (evidenceCount >= 1) {
      level = '적정'
      reason = `${label}: 생기부 근거 ${evidenceCount}건이 확인되나, ${criteria.label}에서 더 두드러지게 축적할 여지가 있습니다.`
    } else {
      level = '보완필요'
      reason = `${label}: 현재 생기부에서 ${criteria.label}와 연결되는 근거가 충분히 확인되지 않아 보완이 필요합니다.`
    }
    return { key, level, reason }
  })

  // 전공 적합성/진로 일관성 한 줄 — 데이터에서 도출(날조 없음).
  const strong = competencyFit.filter((c) => c.level === '강함').map((c) => KEY_LABEL[c.key])
  const weak = competencyFit.filter((c) => c.level === '보완필요').map((c) => KEY_LABEL[c.key])
  let consistencyNote: string
  if (strong.length > 0 && weak.length === 0) {
    consistencyNote = `${criteria.label} 핵심 역량(${strong.join('·')}) 전반에 생기부 근거가 일관되게 누적되어 진로 일관성이 확인됩니다.`
  } else if (strong.length > 0) {
    consistencyNote = `${strong.join('·')}에 근거가 모여 있으나 ${weak.join('·')} 영역의 근거를 보강하면 ${criteria.label} 진로 일관성이 더 분명해집니다.`
  } else {
    consistencyNote = `${criteria.label} 핵심 역량 전반에서 진로와 직결되는 생기부 근거를 더 축적할 필요가 있습니다.`
  }

  const universityFit =
    targetUniversities && targetUniversities.length > 0
      ? assessUniversities(targetUniversities, criteria.label)
      : undefined

  return {
    track,
    label: criteria.label,
    recommendedSubjects: criteria.recommendedSubjects,
    competencyFit,
    consistencyNote,
    caveat: SOURCE_CAVEAT,
    ...(universityFit && universityFit.length > 0 ? { universityFit } : {}),
  }
}
