import { describe, it, expect } from 'vitest'
import { diffSnapshots, tokenize, LAND_THRESHOLD, type Snapshot } from './twin'
import type { PrescribedAction, EvidenceRef } from './types'

const action = (text: string, quote: string): PrescribedAction => ({
  recordArea: 'SETUK',
  competency: 'ACADEMIC',
  text,
  rationale: 'x',
  evidence: { quote, section: '세특' },
})

const ev = (quote: string, section = '세특'): EvidenceRef => ({ quote, section })

const snap = (term: string, actions: PrescribedAction[], evidence: EvidenceRef[]): Snapshot => ({
  term,
  actions,
  evidence,
})

describe('tokenize', () => {
  it('드롭 1-char tokens, splits on non-word, keeps length≥2', () => {
    const toks = tokenize('미적분 회귀분석을, 경제로!')
    expect(toks).toContain('미적분')
    expect(toks).toContain('회귀분석을')
    expect(toks).toContain('경제로')
    expect(toks.every((t) => t.length >= 2)).toBe(true)
  })
  it('keeps latin words length≥2, drops 1-char', () => {
    const toks = tokenize('R&E AI a study')
    expect(toks).toContain('ai')
    expect(toks).toContain('study')
    expect(toks).not.toContain('r')
    expect(toks).not.toContain('a')
  })
})

describe('diffSnapshots', () => {
  it('1) strong overlap → landed with matchedQuote and score≥threshold', () => {
    const prev = snap('고2-1', [action('미적분 회귀분석을 경제로 확장', '미적분')], [])
    const next = snap('고2-2', [], [ev('경제 물가지수를 회귀분석으로 분석함, 미적분 회귀분석 경제 확장')])
    const d = diffSnapshots(prev, next)
    expect(d.outcomes).toHaveLength(1)
    expect(d.outcomes[0].status).toBe('landed')
    expect(d.outcomes[0].matchedQuote).toBe('경제 물가지수를 회귀분석으로 분석함, 미적분 회귀분석 경제 확장')
    expect(d.outcomes[0].score).toBeGreaterThanOrEqual(LAND_THRESHOLD)
  })

  it('2) no overlap → pending, matchedQuote null', () => {
    const prev = snap('고2-1', [action('미적분 회귀분석을 경제로 확장', '미적분')], [])
    const next = snap('고2-2', [], [ev('생물 광합성 실험을 설계함')])
    const d = diffSnapshots(prev, next)
    expect(d.outcomes[0].status).toBe('pending')
    expect(d.outcomes[0].matchedQuote).toBeNull()
  })

  it('3) newEvidence excludes prev quotes (whitespace-insensitive), includes genuinely new', () => {
    const prev = snap('고2-1', [], [ev('미적분 함수 탐구')])
    const next = snap('고2-2', [], [ev('  미적분  함수   탐구 '), ev('새로운 통계 분석 활동')])
    const d = diffSnapshots(prev, next)
    expect(d.newEvidence.map((e) => e.quote)).toEqual(['새로운 통계 분석 활동'])
  })

  it('4) summary counts + landedRate math (2 landed of 3 → 0.67)', () => {
    const prev = snap(
      '고2-1',
      [
        action('미적분 회귀분석 경제 확장', '미적분'),
        action('물리 역학 실험 설계 심화', '물리'),
        action('생물 광합성 효소 반응속도 탐구', '생물'),
      ],
      [],
    )
    const next = snap('고2-2', [], [
      ev('미적분 회귀분석 경제 확장 활동'),
      ev('물리 역학 실험 설계 심화 수행'),
      ev('전혀 무관한 미술 작품 감상'),
    ])
    const d = diffSnapshots(prev, next)
    expect(d.summary.landed).toBe(2)
    expect(d.summary.pending).toBe(1)
    expect(d.summary.landedRate).toBe(0.67)
    expect(d.summary.newEvidence).toBe(3)
  })

  it('5) empty prev.actions → outcomes [], landedRate 0 (no divide-by-zero)', () => {
    const prev = snap('고2-1', [], [])
    const next = snap('고2-2', [], [ev('아무 활동')])
    const d = diffSnapshots(prev, next)
    expect(d.outcomes).toEqual([])
    expect(d.summary.landed).toBe(0)
    expect(d.summary.pending).toBe(0)
    expect(d.summary.landedRate).toBe(0)
  })

  it('6) ordering preserved for outcomes and newEvidence', () => {
    const prev = snap(
      '고2-1',
      [action('알파 회귀분석 경제 탐구', 'a'), action('베타 광합성 효소 실험', 'b')],
      [],
    )
    const next = snap('고2-2', [], [ev('제타 새 활동'), ev('감마 다른 활동')])
    const d = diffSnapshots(prev, next)
    expect(d.outcomes.map((o) => o.action.text)).toEqual([
      '알파 회귀분석 경제 탐구',
      '베타 광합성 효소 실험',
    ])
    expect(d.newEvidence.map((e) => e.quote)).toEqual(['제타 새 활동', '감마 다른 활동'])
    expect(d.from).toBe('고2-1')
    expect(d.to).toBe('고2-2')
  })

  it('action evidence.quote tokens also contribute to matching', () => {
    // text alone wouldn't match; evidence.quote tokens push it over threshold
    const prev = snap('고2-1', [action('확장 심화', '회귀분석 경제 물가지수 분석')], [])
    const next = snap('고2-2', [], [ev('회귀분석 경제 물가지수 분석 수행함')])
    const d = diffSnapshots(prev, next)
    expect(d.outcomes[0].status).toBe('landed')
  })
})
