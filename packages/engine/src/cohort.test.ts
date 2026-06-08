import { describe, it, expect } from 'vitest'
import { resolveCohort } from './cohort'

describe('resolveCohort', () => {
  it('2024 입학 → 2027 구체제(비치헤드)', () => {
    const r = resolveCohort(2024, 'metro')
    expect(r.system).toBe('2027_old'); expect(r.track).toBe('beachhead'); expect(r.emphasizeSetuk).toBe(false)
  })
  it('2025 입학 → 2028 신체제(코어, 세특 가중)', () => {
    const r = resolveCohort(2025, 'non_metro')
    expect(r.system).toBe('2028_new'); expect(r.track).toBe('core'); expect(r.emphasizeSetuk).toBe(true)
  })
  it('2026 입학 → 2029 신체제(코어)', () => {
    expect(resolveCohort(2026, 'unknown').system).toBe('2029_new')
  })
  it('권역을 보존한다', () => {
    expect(resolveCohort(2024, 'non_metro').region).toBe('non_metro')
  })
})
