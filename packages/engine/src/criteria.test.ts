import { describe, it, expect } from 'vitest'
import {
  criteriaForTrack,
  universityCriteria,
  UNIVERSITY_CRITERIA,
  SOURCE_CAVEAT,
  type TrackKey,
} from './criteria'

const ALL_TRACKS: TrackKey[] = ['humanities', 'social', 'natural', 'engineering', 'arts_athletics']

describe('criteriaForTrack', () => {
  it('5개 계열 모두 정의되어 있다', () => {
    for (const t of ALL_TRACKS) {
      const c = criteriaForTrack(t)
      expect(c.track).toBe(t)
      expect(c.label.length).toBeGreaterThan(0)
      expect(c.recommendedSubjects.length).toBeGreaterThan(0)
      expect(c.valuedCompetencies.length).toBeGreaterThan(0)
    }
  })

  it('모든 항목의 note에 caveat이 포함된다(대학별 요강 확인)', () => {
    for (const t of ALL_TRACKS) {
      const c = criteriaForTrack(t)
      expect(c.note.length).toBeGreaterThan(0)
      expect(c.note).toContain('요강')
    }
  })

  it('valuedCompetencies는 ACADEMIC/CAREER/COMMUNITY 중 유효값만 사용한다', () => {
    const valid = new Set(['ACADEMIC', 'CAREER', 'COMMUNITY'])
    for (const t of ALL_TRACKS) {
      for (const comp of criteriaForTrack(t).valuedCompetencies) {
        expect(valid.has(comp)).toBe(true)
      }
    }
  })

  it('계열별 권장과목 방향이 합리적이다(자연=수학/과학, 인문=국어/외국어 등)', () => {
    expect(criteriaForTrack('natural').recommendedSubjects.join(' ')).toMatch(/수학|과학/)
    expect(criteriaForTrack('engineering').recommendedSubjects.join(' ')).toMatch(/물리|수학/)
    expect(criteriaForTrack('humanities').recommendedSubjects.join(' ')).toMatch(/국어|외국어/)
    expect(criteriaForTrack('social').recommendedSubjects.join(' ')).toMatch(/사회|국어/)
  })

  it('결정적: 같은 입력은 같은 출력(불변)', () => {
    expect(criteriaForTrack('natural')).toEqual(criteriaForTrack('natural'))
  })
})

describe('SOURCE_CAVEAT', () => {
  it('정확한 평가요소는 모집요강/시행계획 확인 안내를 담는다', () => {
    expect(SOURCE_CAVEAT.length).toBeGreaterThan(0)
    expect(SOURCE_CAVEAT).toContain('모집요강')
    expect(SOURCE_CAVEAT).toContain('시행계획')
  })
})

describe('universityCriteria (honest registry)', () => {
  it('UNIVERSITY_CRITERIA는 비어 있거나, 항목마다 source+verified를 갖는다(날조 금지)', () => {
    for (const u of UNIVERSITY_CRITERIA) {
      expect(u.source.length).toBeGreaterThan(0)
      expect(typeof u.verified).toBe('boolean')
      expect(u.id.length).toBeGreaterThan(0)
    }
  })

  it('알 수 없는 id → null(정직한 폴백)', () => {
    expect(universityCriteria('unknown')).toBeNull()
    expect(universityCriteria('')).toBeNull()
  })

  it('등록된 항목이 있다면 id로 조회된다', () => {
    if (UNIVERSITY_CRITERIA.length > 0) {
      const first = UNIVERSITY_CRITERIA[0]
      expect(universityCriteria(first.id)).toEqual(first)
    } else {
      expect(UNIVERSITY_CRITERIA).toEqual([])
    }
  })
})
