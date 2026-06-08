import { describe, it, expect } from 'vitest'
import { GOLDEN_CASES } from './fixtures'
import { resolveCohort } from '../cohort'
import { assembleRubric } from '../rubric'
import { FORBIDDEN_KEYWORDS } from '../types'

const expectedSystem: Record<number, string> = { 2024: '2027_old', 2025: '2028_new', 2026: '2029_new' }
const strip = (s: string) => s.replace(/\s+/g, '')

describe('golden regression', () => {
  for (const c of GOLDEN_CASES) {
    describe(c.name, () => {
      const cohort = resolveCohort(c.admissionYear, c.region)
      const rubric = assembleRubric(cohort, c.candidates)
      it('코호트 오분류 0건', () => {
        expect(cohort.system).toBe(expectedSystem[c.admissionYear])
        expect(cohort.region).toBe(c.region)
      })
      it('금지항목 산출 0건', () => {
        for (const it of rubric.items) expect(['SETUK','CREATIVE_REGULAR','BEHAVIOR']).toContain(it.recordArea)
      })
      it('처방 100% 증거인용', () => {
        for (const it of rubric.items) expect(it.evidence.quote.trim().length).toBeGreaterThan(0)
      })
      it('단정형 합격 보장 0건', () => {
        expect(rubric.uncertaintyNote).not.toMatch(/합격을 보장|반드시 합격/)
      })
      it('최소 1건 합법 처방 존재', () => {
        expect(rubric.items.length).toBeGreaterThan(0)
      })
      it('★출력 불변식: 통과 처방의 text/rationale/evidence.quote에 금지 키워드 0건(공백 정규화)', () => {
        for (const it of rubric.items) {
          for (const k of FORBIDDEN_KEYWORDS) {
            const nk = strip(k)
            expect(strip(it.text).includes(nk)).toBe(false)
            expect(strip(it.rationale).includes(nk)).toBe(false)
            expect(strip(it.evidence.quote).includes(nk)).toBe(false)
          }
        }
      })
    })
  }
})
