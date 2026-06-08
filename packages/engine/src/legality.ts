import { ALLOWED_RECORD_AREAS, FORBIDDEN_KEYWORDS, type ActionCandidate, type AllowedRecordArea, type PrescribedAction } from './types'

export interface LegalityResult {
  passed: PrescribedAction[]
  stripped: { recordArea: string; reason: string }[]
}

const isAllowed = (a: string): a is AllowedRecordArea =>
  (ALLOWED_RECORD_AREAS as readonly string[]).includes(a)

/** 최후 안전망: LLM이 무엇을 제안하든 §6.2 ✅ 영역 + 증거 있는 것만 통과. 금지항목 산출 0건 보증. */
export function filterActions(candidates: ActionCandidate[]): LegalityResult {
  const passed: PrescribedAction[] = []
  const stripped: { recordArea: string; reason: string }[] = []
  for (const c of candidates) {
    if (!isAllowed(c.recordArea)) { stripped.push({ recordArea: c.recordArea, reason: '대입 미반영/미기재 영역(§6.2 ❌·⛔)' }); continue }
    const hit = FORBIDDEN_KEYWORDS.find(k => c.text.includes(k) || c.rationale.includes(k))
    if (hit) { stripped.push({ recordArea: c.recordArea, reason: `금지 키워드 포함: ${hit}` }); continue }
    if (!c.evidence) { stripped.push({ recordArea: c.recordArea, reason: '증거인용 누락' }); continue }
    passed.push({ recordArea: c.recordArea, competency: c.competency, text: c.text, rationale: c.rationale, evidence: c.evidence })
  }
  return { passed, stripped }
}
