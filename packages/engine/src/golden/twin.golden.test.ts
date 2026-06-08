import { describe, it, expect } from 'vitest'
import { diffSnapshots, type Snapshot } from '../twin'
import type { PrescribedAction } from '../types'

/**
 * 현실적 2-학기 시나리오(생기부 디지털 트윈):
 * 고2-1 처방 → 고2-2 실제 생기부 증거와 대조.
 *  - "미적분 회귀분석 경제 확장 탐구" 처방 → "경제 물가지수를 회귀분석으로 분석함" 증거로 LAND
 *  - "물리 역학 실험 진로 연계" 처방 → 다음 학기 관련 증거 없음 → PENDING
 *  - 다음 학기에만 등장한 새 증거(독서 연계 발표) → newEvidence로 포착
 *  - prev에서 이월된 동일 인용(체육 대회 참여) → newEvidence에서 제외
 */
const prev: Snapshot = {
  term: '고2-1',
  actions: [
    {
      recordArea: 'SETUK',
      competency: 'ACADEMIC',
      text: '미적분 회귀분석 경제 확장 탐구',
      rationale: '수리·사회 융합 역량 강화',
      evidence: { quote: '미적분 회귀분석 관심', section: '세특' },
    } satisfies PrescribedAction,
    {
      recordArea: 'SETUK',
      competency: 'CAREER',
      text: '물리 역학 실험 진로 연계',
      rationale: '진로 일관성',
      evidence: { quote: '물리 역학 흥미', section: '세특' },
    } satisfies PrescribedAction,
  ],
  evidence: [
    { quote: '미적분 회귀분석 관심', section: '세특' },
    { quote: '물리 역학 흥미', section: '세특' },
    { quote: '체육 대회에 참여함', section: '행특' },
  ],
}

const next: Snapshot = {
  term: '고2-2',
  actions: [],
  evidence: [
    // prev에도 있던 인용이 그대로 이월됨 — newEvidence에서 제외되어야
    { quote: '체육 대회에 참여함', section: '행특' },
    // 처방이 실제로 안착한 새 증거 → 회귀분석 처방 LAND
    { quote: '경제 물가지수를 회귀분석으로 분석함, 미적분 회귀분석 경제 확장 탐구', section: '세특' },
    // 처방과 무관한, 다음 학기에만 등장한 새 증거 → newEvidence
    { quote: '진로 독서를 연계해 발표를 진행함', section: '세특' },
  ],
}

describe('twin golden — 고2-1 → 고2-2 종단 대조', () => {
  const d = diffSnapshots(prev, next)

  it('미적분→경제 회귀분석 처방이 다음 학기 증거에 안착(landed)', () => {
    const o = d.outcomes[0]
    expect(o.action.text).toBe('미적분 회귀분석 경제 확장 탐구')
    expect(o.status).toBe('landed')
    expect(o.matchedQuote).toBe('경제 물가지수를 회귀분석으로 분석함, 미적분 회귀분석 경제 확장 탐구')
  })

  it('물리 진로연계 처방은 다음 학기에 미안착(pending)', () => {
    const o = d.outcomes[1]
    expect(o.action.text).toBe('물리 역학 실험 진로 연계')
    expect(o.status).toBe('pending')
    expect(o.matchedQuote).toBeNull()
  })

  it('새 증거는 기존 이월 인용 제외, 신규만 포착', () => {
    const quotes = d.newEvidence.map((e) => e.quote)
    expect(quotes).toContain('진로 독서를 연계해 발표를 진행함')
    expect(quotes).toContain('경제 물가지수를 회귀분석으로 분석함, 미적분 회귀분석 경제 확장 탐구')
    expect(quotes).not.toContain('체육 대회에 참여함')
  })

  it('요약: 1 landed / 2 → 0.5, 새 증거 2건', () => {
    expect(d.summary).toEqual({ landed: 1, pending: 1, landedRate: 0.5, newEvidence: 2 })
  })
})
