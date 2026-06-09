import { describe, it, expect } from 'vitest'
import {
  criteriaForTrack,
  universityCriteria,
  UNIVERSITY_CRITERIA,
  SOURCE_CAVEAT,
  COMMON_EVALUATION_FRAMEWORK,
  EVAL_FRAMEWORK_SOURCE,
  EVAL_FRAMEWORK_NAME,
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

  it('모든 항목의 note에 SOURCE_CAVEAT 전문이 포함된다', () => {
    for (const t of ALL_TRACKS) {
      expect(criteriaForTrack(t).note).toContain(SOURCE_CAVEAT)
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

  it('자연계열 권장과목은 미적분 & 확률과통계를 언급한다(검증 리플릿)', () => {
    const subj = criteriaForTrack('natural').recommendedSubjects.join(' ')
    expect(subj).toContain('미적분')
    expect(subj).toContain('확률과통계')
  })

  it('자연·공학계열은 subjectsSource(검증 출처)를 갖는다', () => {
    expect(criteriaForTrack('natural').subjectsSource).toBeDefined()
    expect(criteriaForTrack('natural').subjectsSource!.startsWith('https://')).toBe(true)
    expect(criteriaForTrack('engineering').subjectsSource).toBeDefined()
    expect(criteriaForTrack('engineering').subjectsSource!.startsWith('https://')).toBe(true)
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

describe('COMMON_EVALUATION_FRAMEWORK (5개 대학 공동연구 10항목)', () => {
  it('3개 역량으로 구성된다', () => {
    expect(COMMON_EVALUATION_FRAMEWORK).toHaveLength(3)
    const keys = COMMON_EVALUATION_FRAMEWORK.map((c) => c.key)
    expect(keys).toEqual(['ACADEMIC', 'CAREER', 'COMMUNITY'])
  })

  it('항목 수가 3/3/4 = 총 10개다', () => {
    const counts = COMMON_EVALUATION_FRAMEWORK.map((c) => c.items.length)
    expect(counts).toEqual([3, 3, 4])
    const total = counts.reduce((a, b) => a + b, 0)
    expect(total).toBe(10)
  })

  it('모든 역량과 항목은 비어있지 않은 정의를 갖는다', () => {
    for (const comp of COMMON_EVALUATION_FRAMEWORK) {
      expect(comp.label.length).toBeGreaterThan(0)
      expect(comp.definition.length).toBeGreaterThan(0)
      for (const item of comp.items) {
        expect(item.key.length).toBeGreaterThan(0)
        expect(item.label.length).toBeGreaterThan(0)
        expect(item.definition.length).toBeGreaterThan(0)
      }
    }
  })

  it('EVAL_FRAMEWORK_SOURCE/NAME은 비어있지 않다', () => {
    expect(EVAL_FRAMEWORK_SOURCE.length).toBeGreaterThan(0)
    expect(EVAL_FRAMEWORK_SOURCE.startsWith('https://')).toBe(true)
    expect(EVAL_FRAMEWORK_NAME.length).toBeGreaterThan(0)
  })
})

describe('universityCriteria (verified registry)', () => {
  it('UNIVERSITY_CRITERIA는 항목마다 source+verified를 갖는다(날조 금지)', () => {
    for (const u of UNIVERSITY_CRITERIA) {
      expect(u.source.length).toBeGreaterThan(0)
      expect(u.source.startsWith('https://')).toBe(true)
      expect(typeof u.verified).toBe('boolean')
      expect(u.id.length).toBeGreaterThan(0)
      expect(u.name.length).toBeGreaterThan(0)
      expect(u.evaluationFraming.length).toBeGreaterThan(0)
    }
  })

  it('검증된 5개 대학 id를 갖는다', () => {
    const ids = UNIVERSITY_CRITERIA.map((u) => u.id).sort()
    expect(ids).toEqual(['hanyang', 'korea', 'skku', 'snu', 'yonsei'])
  })

  it('모든 등록 항목은 verified=true이며 실제 https 출처를 갖는다', () => {
    for (const u of UNIVERSITY_CRITERIA) {
      expect(u.verified).toBe(true)
      expect(u.source.startsWith('https://')).toBe(true)
    }
  })

  it("universityCriteria('snu')는 verified=true이고 https 출처다", () => {
    const snu = universityCriteria('snu')
    expect(snu).not.toBeNull()
    expect(snu!.verified).toBe(true)
    expect(snu!.source.startsWith('https://')).toBe(true)
  })

  it('알 수 없는 id → null(정직한 폴백)', () => {
    expect(universityCriteria('unknown')).toBeNull()
    expect(universityCriteria('')).toBeNull()
  })

  it('등록된 항목은 id로 정확히 조회된다', () => {
    for (const u of UNIVERSITY_CRITERIA) {
      expect(universityCriteria(u.id)).toEqual(u)
    }
  })
})
