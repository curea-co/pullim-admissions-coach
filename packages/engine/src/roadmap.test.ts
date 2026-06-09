import { describe, it, expect } from 'vitest'
import { buildRoadmap } from './roadmap'
import { resolveCohort } from './cohort'

describe('buildRoadmap', () => {
  it('5단계 표준 학종 타임라인을 안정적 순서로 반환한다', () => {
    const r = buildRoadmap(resolveCohort(2025, 'metro'), 1)
    expect(r.phases.map((p) => p.key)).toEqual([
      'record_build',
      'apply',
      'interview',
      'csat',
      'final',
    ])
  })

  it('고1 → 생기부 빌드 단계가 active', () => {
    const r = buildRoadmap(resolveCohort(2026, 'metro'), 1)
    const active = r.phases.filter((p) => p.active).map((p) => p.key)
    expect(active).toEqual(['record_build'])
  })

  it('고2 → 생기부 빌드 단계가 active', () => {
    const r = buildRoadmap(resolveCohort(2026, 'metro'), 2)
    const active = r.phases.filter((p) => p.active).map((p) => p.key)
    expect(active).toEqual(['record_build'])
  })

  it('고3 → 원서/면접/수능/정시 단계가 강조된다', () => {
    const r = buildRoadmap(resolveCohort(2024, 'metro'), 3)
    const active = r.phases.filter((p) => p.active).map((p) => p.key)
    expect(active).toEqual(['apply', 'interview', 'csat', 'final'])
  })

  it('2027 구체제 → 선택형/9등급 노트', () => {
    const r = buildRoadmap(resolveCohort(2024, 'metro'), 1)
    expect(r.system).toBe('2027_old')
    expect(r.note).toMatch(/선택형|9등급/)
  })

  it('2028 신체제 → 통합형 수능/5등급/정성평가 노트', () => {
    const r = buildRoadmap(resolveCohort(2025, 'metro'), 1)
    expect(r.system).toBe('2028_new')
    expect(r.note).toMatch(/통합형|5등급|정성/)
  })

  it('2029 신체제 → 신체제 노트', () => {
    const r = buildRoadmap(resolveCohort(2026, 'metro'), 1)
    expect(r.system).toBe('2029_new')
    expect(r.note).toMatch(/통합형|5등급|정성/)
  })

  it('admissionYear는 입학연도(코호트)가 고정 — 학년과 무관하게 대입 학년도', () => {
    const cohort = resolveCohort(2025, 'metro') // 2025 입학 → 2028_new → 대입 2028
    expect(buildRoadmap(cohort, 1).admissionYear).toBe(2028)
    expect(buildRoadmap(cohort, 2).admissionYear).toBe(2028)
    expect(buildRoadmap(cohort, 3).admissionYear).toBe(2028)
    expect(buildRoadmap(resolveCohort(2024, 'metro'), 3).admissionYear).toBe(2027)
    expect(buildRoadmap(resolveCohort(2026, 'metro'), 1).admissionYear).toBe(2029)
  })

  it('focus에 금지영역(자소서/학원/소논문) 키워드가 없다', () => {
    const forbidden = ['자소서', '자기소개서', '학원', '소논문', 'R&E', '컨설팅']
    for (const grade of [1, 2, 3]) {
      for (const year of [2024, 2025, 2026]) {
        const r = buildRoadmap(resolveCohort(year, 'metro'), grade)
        for (const phase of r.phases) {
          const text = phase.focus.join(' ')
          for (const f of forbidden) {
            expect(text).not.toContain(f)
          }
        }
      }
    }
  })

  it('모든 phase는 label/window/focus를 갖는다', () => {
    const r = buildRoadmap(resolveCohort(2025, 'metro'), 2)
    for (const p of r.phases) {
      expect(p.label.length).toBeGreaterThan(0)
      expect(p.window.length).toBeGreaterThan(0)
      expect(p.focus.length).toBeGreaterThan(0)
    }
  })

  it('결정적: monthHint 동일 입력 → 동일 출력', () => {
    const cohort = resolveCohort(2025, 'metro')
    expect(buildRoadmap(cohort, 3, 9)).toEqual(buildRoadmap(cohort, 3, 9))
  })

  it('monthHint를 줘도 학년 기반 active 집합이 유지된다(Date 미사용)', () => {
    const cohort = resolveCohort(2025, 'metro')
    const a = buildRoadmap(cohort, 1, 1).phases.filter((p) => p.active).map((p) => p.key)
    const b = buildRoadmap(cohort, 1, 12).phases.filter((p) => p.active).map((p) => p.key)
    expect(a).toEqual(b)
    expect(a).toEqual(['record_build'])
  })
})
