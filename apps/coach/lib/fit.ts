import { criteriaForTrack, SOURCE_CAVEAT, type TrackKey, type Competency } from '@pullim/engine'
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
}

const KEY_LABEL: Record<Competency, string> = {
  ACADEMIC: '학업역량',
  CAREER: '진로역량',
  COMMUNITY: '공동체역량',
}

export function assessFit(track: TrackKey, diagnosis: Diagnosis): FitAssessment {
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

  return {
    track,
    label: criteria.label,
    recommendedSubjects: criteria.recommendedSubjects,
    competencyFit,
    consistencyNote,
    caveat: SOURCE_CAVEAT,
  }
}
