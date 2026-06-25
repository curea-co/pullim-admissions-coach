import type { Snapshot } from '@pullim/engine'
import type { AnalyzeResult } from './analyze'

/**
 * 한 학기 분석 결과(AnalyzeResult)를 종단 트윈 diff용 스냅샷으로 축약하는 순수 어댑터.
 *
 * - actions  = 그 학기에 산출한 합법 처방(rubric.items)
 * - evidence = 그 학기에 관측된 모든 근거 인용
 *              (진단 criteria[].evidence[]  ∪  처방 items[].evidence) — 인용(quote) 기준 중복 제거.
 *
 * 부수효과 없음. 입력 순서 보존(진단 근거 우선, 그다음 처방 근거).
 */
export function toSnapshot(term: string, r: AnalyzeResult): Snapshot {
  const seen = new Set<string>()
  const evidence: Snapshot['evidence'] = []

  const push = (e: { quote: string; section: string }) => {
    if (seen.has(e.quote)) return
    seen.add(e.quote)
    evidence.push(e)
  }

  for (const c of r.diagnosis.criteria) for (const e of c.evidence) push(e)
  for (const it of r.rubric.items) push(it.evidence)

  return { term, actions: r.rubric.items, evidence }
}
