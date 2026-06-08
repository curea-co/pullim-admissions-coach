import type { PrescribedAction, EvidenceRef } from './types'

/**
 * 종단 "생기부 디지털 트윈" diff 엔진 (moat #2 = 닫힌 루프).
 *
 * 한 학기에 합법 처방을 내리면, 다음 학기에 그 처방이 실제로 생기부에 "안착"했는지를
 * 결정론적으로 대조한다. (LLM 판정은 향후 확장 — 본 모듈은 순수·테스트 가능·네트워크 불요.)
 *
 * 부수효과 없음. Date/random 사용 안 함. 입력 순서 보존.
 */

/** 안착 판정 임계값. 액션 토큰 중 다음-학기 인용에 등장한 비율이 이 값 이상이면 landed. */
export const LAND_THRESHOLD = 0.34

/** 한 학기의 코칭 상태를, diff에 필요한 만큼으로 축약한 스냅샷. */
export interface Snapshot {
  term: string // 예: "고2-1"
  actions: PrescribedAction[] // 그 학기에 처방한 항목(rubric.items)
  evidence: EvidenceRef[] // 그 학기에 관측된 모든 증거 인용(진단 + 루브릭)
}

export type LandedStatus = 'landed' | 'pending'

export interface ActionOutcome {
  action: PrescribedAction
  status: LandedStatus
  matchedQuote: string | null // landed라면 충족시킨 다음-학기 인용, 아니면 null
  score: number // 겹침 점수 0..1 (투명성/임계값 튜닝용)
}

export interface TwinDiff {
  from: string // prev.term
  to: string // next.term
  outcomes: ActionOutcome[] // prev.action당 1건: 다음 학기에 안착했는가?
  newEvidence: EvidenceRef[] // next에는 있으나 prev에는 없는 증거(정규화 인용 기준)
  summary: { landed: number; pending: number; landedRate: number; newEvidence: number }
}

/**
 * 토큰화: 한국어는 대소문자가 무의미하나 latin 토큰을 위해 lowercase 적용.
 * 공백/구두점 등 non-word 문자로 분할하고, 길이 ≥2 토큰만 유지(1-char 토큰은 드롭).
 * 한국어는 부분 어절이 그대로 토큰이 되고, latin 단어도 그대로 토큰이 된다.
 */
export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    // 한글/영문/숫자가 아닌 문자를 구분자로 사용
    .split(/[^0-9a-z가-힣㄰-㆏]+/)
    .filter((t) => t.length >= 2)
}

/** 공백 제거 정규화(인용 동일성 비교용). */
function stripWs(s: string): string {
  return s.replace(/\s+/g, '')
}

/**
 * 액션 안착 점수: 액션 텍스트 + 액션 evidence.quote의 distinct 토큰 중,
 * 주어진 인용(quote) 토큰 집합에 등장하는 토큰의 비율.
 * 분모가 0이면 0(빈 액션 보호).
 */
function overlapScore(actionTokens: Set<string>, quoteTokens: Set<string>): number {
  if (actionTokens.size === 0) return 0
  let hit = 0
  for (const t of actionTokens) if (quoteTokens.has(t)) hit++
  return hit / actionTokens.size
}

/** prev 처방이 next 증거에 실제로 안착했는지를 결정론적으로 대조한다. */
export function diffSnapshots(prev: Snapshot, next: Snapshot): TwinDiff {
  // next 증거별 토큰 집합 사전계산(순서 보존).
  const nextQuoteTokens = next.evidence.map((e) => ({
    quote: e.quote,
    tokens: new Set(tokenize(e.quote)),
  }))

  const outcomes: ActionOutcome[] = prev.actions.map((action) => {
    // 액션 텍스트 + 액션 자체 evidence.quote 토큰을 합쳐 distinct 집합 구성.
    const actionTokens = new Set([...tokenize(action.text), ...tokenize(action.evidence.quote)])

    let bestScore = 0
    let bestQuote: string | null = null
    for (const nq of nextQuoteTokens) {
      const score = overlapScore(actionTokens, nq.tokens)
      if (score > bestScore) {
        bestScore = score
        bestQuote = nq.quote
      }
    }

    const landed = bestScore >= LAND_THRESHOLD
    return {
      action,
      status: landed ? 'landed' : 'pending',
      matchedQuote: landed ? bestQuote : null,
      score: bestScore,
    }
  })

  // newEvidence: 정규화(공백 제거) 인용이 prev 증거 집합에 없는 next 증거(순서 보존).
  const prevQuoteSet = new Set(prev.evidence.map((e) => stripWs(e.quote)))
  const newEvidence = next.evidence.filter((e) => !prevQuoteSet.has(stripWs(e.quote)))

  const landed = outcomes.filter((o) => o.status === 'landed').length
  const pending = outcomes.length - landed
  // landedRate = landed / max(1, 총 액션 수), 소수 2자리 반올림(0 나눗셈 보호).
  const landedRate = Math.round((landed / Math.max(1, prev.actions.length)) * 100) / 100

  return {
    from: prev.term,
    to: next.term,
    outcomes,
    newEvidence,
    summary: { landed, pending, landedRate, newEvidence: newEvidence.length },
  }
}
