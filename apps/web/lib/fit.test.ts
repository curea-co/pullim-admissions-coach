import { describe, it, expect } from 'vitest'
import { assessFit } from './fit'
import type { Diagnosis } from './ai/schemas'
import type { TrackKey } from '@pullim/engine'

const ev = (n: number) => Array.from({ length: n }, (_, i) => ({ quote: `q${i}`, section: '세특' }))

const TRACKS: TrackKey[] = ['humanities', 'social', 'natural', 'engineering', 'arts_athletics']

describe('assessFit (deterministic, 정성 fit only)', () => {
  it('근거 2개+강점 → 강함, 근거 1개 → 적정, 근거 없음 → 보완필요', () => {
    // natural valuedCompetencies = ['ACADEMIC','CAREER']
    const diagnosis: Diagnosis = {
      criteria: [
        { key: 'ACADEMIC', mapping: 'm', strength: '강점 있음', weakness: 'w', evidence: ev(2) },
        { key: 'CAREER', mapping: 'm', strength: '', weakness: 'w', evidence: ev(1) },
      ],
    }
    const out = assessFit('natural', diagnosis)
    const academic = out.competencyFit.find((c) => c.key === 'ACADEMIC')!
    const career = out.competencyFit.find((c) => c.key === 'CAREER')!
    expect(academic.level).toBe('강함')
    expect(career.level).toBe('적정')
  })

  it('근거 없는 valued 역량은 보완필요', () => {
    const diagnosis: Diagnosis = { criteria: [] }
    const out = assessFit('engineering', diagnosis)
    expect(out.competencyFit.every((c) => c.level === '보완필요')).toBe(true)
  })

  it('caveat이 항상 존재', () => {
    const out = assessFit('humanities', { criteria: [] })
    expect(out.caveat.length).toBeGreaterThan(0)
  })

  it('점수·%·합격 표현이 어디에도 없다', () => {
    const diagnosis: Diagnosis = {
      criteria: [
        { key: 'ACADEMIC', mapping: 'm', strength: '강점', weakness: 'w', evidence: ev(3) },
        { key: 'CAREER', mapping: 'm', strength: '강점', weakness: 'w', evidence: ev(2) },
        { key: 'COMMUNITY', mapping: 'm', strength: '강점', weakness: 'w', evidence: ev(2) },
      ],
    }
    const blob = TRACKS.map((t) => JSON.stringify(assessFit(t, diagnosis))).join('\n')
    expect(blob).not.toMatch(/%/)
    expect(blob).not.toMatch(/합격/)
    expect(blob).not.toMatch(/점수/)
    expect(blob).not.toMatch(/\d+\s*점/)
    expect(blob).not.toMatch(/가능성/)
  })

  it('5개 트랙 모두 label을 반환', () => {
    for (const t of TRACKS) {
      const out = assessFit(t, { criteria: [] })
      expect(out.label.length).toBeGreaterThan(0)
      expect(out.track).toBe(t)
      expect(out.recommendedSubjects.length).toBeGreaterThan(0)
      expect(out.competencyFit.length).toBeGreaterThan(0)
      expect(out.consistencyNote.length).toBeGreaterThan(0)
    }
  })
})

describe('assessFit — 목표 대학(universityFit)', () => {
  const diagnosis: Diagnosis = { criteria: [] }

  it('목표 대학 미입력 시 universityFit 없음(기존 출력과 동일 shape)', () => {
    expect(assessFit('social', diagnosis).universityFit).toBeUndefined()
    expect(assessFit('social', diagnosis, []).universityFit).toBeUndefined()
  })

  it('KB 수록 대학 → 검증 데이터(정식명·평가틀·출처)가 그대로 담긴다', () => {
    const out = assessFit('natural', diagnosis, ['서울대'])
    expect(out.universityFit).toHaveLength(1)
    const u = out.universityFit![0]
    expect(u.matched).toBe(true)
    expect(u.name).toBe('서울대학교')
    expect(u.evaluationFraming!.length).toBeGreaterThan(0)
    expect(u.source!.startsWith('https://')).toBe(true)
    expect(u.note.length).toBeGreaterThan(0)
  })

  it('미수록 대학 → 사실 필드 없이 정직 폴백 안내만(날조 금지)', () => {
    const out = assessFit('social', diagnosis, ['한국교원대학교'])
    const u = out.universityFit![0]
    expect(u.matched).toBe(false)
    expect(u.name).toBeUndefined()
    expect(u.evaluationFraming).toBeUndefined()
    expect(u.source).toBeUndefined()
    expect(u.note).toContain('수록되지 않았습니다')
    expect(u.note).toContain('모집요강')
  })

  it('중복(약칭·공백 변형 포함)은 1건으로 합치고 최대 3건만', () => {
    const out = assessFit('social', diagnosis, ['서울대', '서울대학교', '연세대'])
    expect(out.universityFit!.map((u) => u.name)).toEqual(['서울대학교', '연세대학교'])
  })

  it('대학 노트에도 합격·가능성 단정 표현이 없다', () => {
    const blob = JSON.stringify(
      assessFit('social', diagnosis, ['서울대', '고려대', '미수록대학교']).universityFit,
    )
    expect(blob).not.toMatch(/합격/)
    expect(blob).not.toMatch(/가능성/)
  })
})
