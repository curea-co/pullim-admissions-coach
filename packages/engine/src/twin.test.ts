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
    // 형태소 정규화로 조사 '을'/'로'가 탈락 → 어간 토큰만 남는다.
    const toks = tokenize('미적분 회귀분석을, 경제로!')
    expect(toks).toContain('미적분')
    expect(toks).toContain('회귀분석')
    expect(toks).toContain('경제')
    expect(toks.every((t) => t.length >= 2)).toBe(true)
  })
  it('keeps latin words length≥2, drops 1-char', () => {
    const toks = tokenize('R&E AI a study')
    expect(toks).toContain('ai')
    expect(toks).toContain('study')
    expect(toks).not.toContain('r')
    expect(toks).not.toContain('a')
  })

  it('strips longest matching Korean particle (조사), keeps ≥2-char stem', () => {
    // 을/를/은/는/이/가 → 어간으로 정규화
    expect(tokenize('통계를')).toContain('통계')
    expect(tokenize('통계')).toContain('통계')
    expect(tokenize('회귀분석을')).toContain('회귀분석')
    expect(tokenize('회귀분석으로')).toContain('회귀분석') // 2자 조사 '으로' (가장 긴 매칭)
    expect(tokenize('탐구보고서를')).toContain('탐구보고서')
    expect(tokenize('경제로')).toContain('경제') // 1자 조사 '로'
  })

  it('strips common verb/adj endings & nominalizers', () => {
    expect(tokenize('분석함')).toContain('분석')
    expect(tokenize('분석했다')).toContain('분석')
    expect(tokenize('발표하고')).toContain('발표')
    expect(tokenize('진행하는')).toContain('진행')
    expect(tokenize('연계되어')).toContain('연계')
  })

  it('does NOT touch latin/digit tokens', () => {
    expect(tokenize('study2024')).toContain('study2024')
    expect(tokenize('regression')).toContain('regression')
    expect(tokenize('2025')).toContain('2025')
  })

  it('does NOT over-strip: stem must remain ≥2 한글 chars', () => {
    // '가가' (len 2) < 3 → 조사 분리 시도 안 함, 그대로 유지
    expect(tokenize('가가')).toContain('가가')
    // '통계' (len 2) — '계'가 조사 목록에 없지만, 애초에 len<3이라 미시도
    expect(tokenize('통계')).toContain('통계')
  })

  it('GUARD against false merges: distinct tokens stay distinct', () => {
    // 독서/독자, 수상/수학 — 끝 글자가 다르고 조사가 아니므로 병합되면 안 됨
    expect(tokenize('독서')).toEqual(['독서'])
    expect(tokenize('독자')).toEqual(['독자'])
    expect(tokenize('수상')).toEqual(['수상'])
    expect(tokenize('수학')).toEqual(['수학'])
    expect(tokenize('독서')).not.toEqual(tokenize('독자'))
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

  it('7) inflected forms now match: 회귀분석을 lands against 회귀분석으로/회귀분석', () => {
    // 형태소 정규화 전이라면 회귀분석을 ≠ 회귀분석으로 ≠ 회귀분석 으로 pending이었음.
    const prev = snap('고2-1', [action('회귀분석을 경제로 확장', '회귀분석을')], [])
    const next = snap('고2-2', [], [ev('경제 물가지수를 회귀분석으로 분석함')])
    const d = diffSnapshots(prev, next)
    expect(d.outcomes[0].status).toBe('landed')
    expect(d.outcomes[0].matchedQuote).toBe('경제 물가지수를 회귀분석으로 분석함')
  })

  it('8) 탐구보고서를 matches bare 탐구보고서 (particle stripped)', () => {
    const prev = snap('고2-1', [action('탐구보고서를 작성', '탐구보고서를')], [])
    const next = snap('고2-2', [], [ev('탐구보고서 작성을 완료함')])
    const d = diffSnapshots(prev, next)
    expect(d.outcomes[0].status).toBe('landed')
  })

  it('9) 통계를 ↔ 통계 unify via particle stripping', () => {
    const prev = snap('고2-1', [action('통계를 활용한 분석', '통계를')], [])
    const next = snap('고2-2', [], [ev('통계 기법을 활용해 분석함')])
    const d = diffSnapshots(prev, next)
    expect(d.outcomes[0].status).toBe('landed')
  })

  it('action evidence.quote tokens also contribute to matching', () => {
    // text alone wouldn't match; evidence.quote tokens push it over threshold
    const prev = snap('고2-1', [action('확장 심화', '회귀분석 경제 물가지수 분석')], [])
    const next = snap('고2-2', [], [ev('회귀분석 경제 물가지수 분석 수행함')])
    const d = diffSnapshots(prev, next)
    expect(d.outcomes[0].status).toBe('landed')
  })
})
