import { ALLOWED_RECORD_AREAS, FORBIDDEN_KEYWORDS, type ActionCandidate, type AllowedRecordArea, type PrescribedAction } from './types'

export interface LegalityResult {
  passed: PrescribedAction[]
  stripped: { recordArea: string; reason: string }[]
}

const isAllowed = (a: string): a is AllowedRecordArea =>
  (ALLOWED_RECORD_AREAS as readonly string[]).includes(a)

/** 띄어쓰기 변형 우회 차단: 내부 공백 전부 제거 후 부분문자열 비교(단어경계 아님). */
const stripWs = (s: string) => s.replace(/\s+/g, '')

/** 최후 안전망: LLM이 무엇을 제안하든 §6.2 ✅ 영역 + 증거 있는 것만 통과. 금지항목 산출 0건 보증. */
export function filterActions(candidates: ActionCandidate[]): LegalityResult {
  const passed: PrescribedAction[] = []
  const stripped: { recordArea: string; reason: string }[] = []
  for (const c of candidates) {
    const recordArea = c.recordArea.trim()
    if (!isAllowed(recordArea)) { stripped.push({ recordArea, reason: '대입 미반영/미기재 영역(§6.2 ❌·⛔)' }); continue }
    // text·rationale·evidence.quote 세 필드 모두 스캔(공백 정규화로 띄어쓰기 변형 우회 차단)
    const scanned = [c.text, c.rationale, c.evidence?.quote ?? ''].map(stripWs)
    const hit = FORBIDDEN_KEYWORDS.find(k => { const nk = stripWs(k); return scanned.some(f => f.includes(nk)) })
    if (hit) { stripped.push({ recordArea, reason: `금지 키워드 포함: ${hit}` }); continue }
    if (!c.evidence || c.evidence.quote.trim().length === 0) { stripped.push({ recordArea, reason: '증거인용 누락' }); continue }
    passed.push({ recordArea, competency: c.competency, text: c.text, rationale: c.rationale, evidence: c.evidence })
  }
  return { passed, stripped }
}
