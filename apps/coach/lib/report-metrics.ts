/**
 * 리포트 시각화용 "정직 지표" 파생기 — 순수 함수, 네트워크/`server-only` 없음.
 *
 * ★ 신뢰 원칙: 여기서 만드는 값은 전부 응답에서 **실제로 세거나 계산한 수량**이다.
 * 1–5 점수·합격%·"역량 점수" 같은 단정형 수치는 절대 만들지 않는다(가드레일).
 * 모든 지표는 근거/활동/반영 **수·비율**이며, 차트는 이 객체만 그린다.
 */
import type { TwinDiff } from '@pullim/engine'
import type { AnalyzeResult } from './analyze'

export type Competency = 'ACADEMIC' | 'CAREER' | 'COMMUNITY'

/** 역량별 근거 수(diagnosis.criteria[key].evidence.length) — 진짜 카운트. */
export interface EvidenceByCompetency {
  key: Competency
  /** 학업/진로/공동체 한글 라벨 */
  label: string
  /** diagnosis.criteria[key].evidence.length */
  count: number
}

/** 역량별 처방 수(rubric.items 중 해당 competency 개수) — 진짜 카운트. */
export interface PrescriptionsByCompetency {
  key: Competency
  label: string
  /** rubric.items.filter(competency===key).length */
  count: number
}

/** 기재영역별 처방 수(세특/정규창체/행특) — 진짜 카운트. */
export interface PrescriptionsByArea {
  /** SETUK | CREATIVE_REGULAR | BEHAVIOR */
  area: string
  label: string
  count: number
}

/** 합법 처방 vs 게이트 자동 제외 — 진짜 카운트. */
export interface Legality {
  /** rubric.items.length (게이트 통과 = 합법 처방) */
  allowed: number
  /** rubric.stripped.length (자동 제외 = 대입 미반영·금지) */
  stripped: number
  /** allowed / (allowed+stripped); 분모 0이면 0 */
  allowedRate: number
}

/** 반영률(twin 있을 때만) — twin.summary에서 그대로. */
export interface Reflection {
  /** twin.summary.landedRate (0..1) */
  rate: number
  /** twin.summary.landed */
  landed: number
  /** twin.summary.pending */
  pending: number
  /** twin.summary.newEvidence (이번 학기 새로 쌓인 근거 수) */
  newEvidence: number
}

export interface ReportMetrics {
  evidenceByCompetency: EvidenceByCompetency[]
  prescriptionsByCompetency: PrescriptionsByCompetency[]
  prescriptionsByArea: PrescriptionsByArea[]
  legality: Legality
  /** twin/priorSaengbu가 있을 때만 채워진다. */
  reflection?: Reflection
  /** 근거 총합(역량별 근거 수의 합) — 라벨/요약용. */
  totalEvidence: number
}

const COMP_ORDER: Competency[] = ['ACADEMIC', 'CAREER', 'COMMUNITY']
const COMP_LABEL: Record<Competency, string> = {
  ACADEMIC: '학업',
  CAREER: '진로',
  COMMUNITY: '공동체',
}
const AREA_ORDER = ['SETUK', 'CREATIVE_REGULAR', 'BEHAVIOR'] as const
const AREA_LABEL: Record<string, string> = {
  SETUK: '세특',
  CREATIVE_REGULAR: '창체',
  BEHAVIOR: '행특',
}

/**
 * AnalyzeResult(+선택 twin)에서 시각화용 실제 수량만 파생한다.
 * 점수·확률 등 가공 수치는 일절 만들지 않는다.
 */
export function reportMetrics(data: AnalyzeResult, twin?: TwinDiff): ReportMetrics {
  // 역량별 근거 수 — criteria가 빠진 역량도 0으로 채워 3축이 항상 렌더된다.
  const byKey = new Map<Competency, number>()
  for (const c of data.diagnosis.criteria) {
    byKey.set(c.key, (byKey.get(c.key) ?? 0) + c.evidence.length)
  }
  const evidenceByCompetency: EvidenceByCompetency[] = COMP_ORDER.map((key) => ({
    key,
    label: COMP_LABEL[key],
    count: byKey.get(key) ?? 0,
  }))
  const totalEvidence = evidenceByCompetency.reduce((s, e) => s + e.count, 0)

  // 역량별 처방 수.
  const presByKey = new Map<Competency, number>()
  for (const it of data.rubric.items) {
    presByKey.set(it.competency, (presByKey.get(it.competency) ?? 0) + 1)
  }
  const prescriptionsByCompetency: PrescriptionsByCompetency[] = COMP_ORDER.map((key) => ({
    key,
    label: COMP_LABEL[key],
    count: presByKey.get(key) ?? 0,
  }))

  // 기재영역별 처방 수.
  const presByArea = new Map<string, number>()
  for (const it of data.rubric.items) {
    presByArea.set(it.recordArea, (presByArea.get(it.recordArea) ?? 0) + 1)
  }
  const prescriptionsByArea: PrescriptionsByArea[] = AREA_ORDER.map((area) => ({
    area,
    label: AREA_LABEL[area] ?? area,
    count: presByArea.get(area) ?? 0,
  }))

  // 합법 vs 자동 제외.
  const allowed = data.rubric.items.length
  const stripped = data.rubric.stripped.length
  const total = allowed + stripped
  const legality: Legality = {
    allowed,
    stripped,
    allowedRate: total === 0 ? 0 : allowed / total,
  }

  const result: ReportMetrics = {
    evidenceByCompetency,
    prescriptionsByCompetency,
    prescriptionsByArea,
    legality,
    totalEvidence,
  }

  const t = twin ?? data.twin
  if (t) {
    result.reflection = {
      rate: t.summary.landedRate,
      landed: t.summary.landed,
      pending: t.summary.pending,
      newEvidence: t.summary.newEvidence,
    }
  }
  return result
}
