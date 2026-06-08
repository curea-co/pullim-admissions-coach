/** §6.2 대입-반영 = 처방 허용 영역 (이것만 RecordArea로 인정) */
export type AllowedRecordArea = 'SETUK' | 'CREATIVE_REGULAR' | 'BEHAVIOR'
export const ALLOWED_RECORD_AREAS: readonly AllowedRecordArea[] = ['SETUK', 'CREATIVE_REGULAR', 'BEHAVIOR']

/** ❌ 미반영 + ⛔ 미기재 = 처방/언급 금지 (LLM이 제안하면 게이트가 제거) */
export const FORBIDDEN_RECORD_AREAS = [
  'AWARD', 'AUTONOMOUS_CLUB', 'VOLUNTEER_EXTERNAL', 'READING', 'CERTIFICATE', 'GIFTED',
  'RESEARCH_PAPER', 'EXTERNAL_AWARD', 'PRIVATE_EDU', 'PARENT_BACKGROUND',
] as const

/** ⛔ 언급 자체 금지 키워드(텍스트 스캔용) */
export const FORBIDDEN_KEYWORDS = ['소논문', 'R&E', '교외 수상', '학원', '컨설팅'] as const

export type Competency = 'ACADEMIC' | 'CAREER' | 'COMMUNITY'
export type CohortSystem = '2027_old' | '2028_new' | '2029_new'
export type Track = 'beachhead' | 'core'
export type Region = 'metro' | 'non_metro' | 'unknown'

export interface CohortResult {
  system: CohortSystem
  track: Track
  region: Region
  /** 신체제 정성평가 가중(세특 우선) 여부 */
  emphasizeSetuk: boolean
}

export interface EvidenceRef { quote: string; section: string }

/** LLM이 제안하는 처방 후보(검증 전) */
export interface ActionCandidate {
  recordArea: string // 임의 문자열 — 게이트가 검증
  competency: Competency
  text: string
  rationale: string
  evidence: EvidenceRef | null
}

/** 게이트 통과 + 조립된 합법 처방 */
export interface PrescribedAction {
  recordArea: AllowedRecordArea
  competency: Competency
  text: string
  rationale: string
  evidence: EvidenceRef
}

export interface Rubric {
  cohort: CohortResult
  items: PrescribedAction[]
  uncertaintyNote: string
  stripped: { recordArea: string; reason: string }[]
}
