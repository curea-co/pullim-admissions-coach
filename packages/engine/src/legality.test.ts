import { describe, it, expect } from 'vitest'
import { filterActions } from './legality'
import type { ActionCandidate } from './types'

const mk = (recordArea: string, text = '내용', evidence = { quote: 'q', section: 's' }): ActionCandidate =>
  ({ recordArea, competency: 'ACADEMIC', text, rationale: 'r', evidence })

describe('filterActions', () => {
  it('✅ 허용 영역은 통과', () => {
    const { passed, stripped } = filterActions([mk('SETUK'), mk('CREATIVE_REGULAR'), mk('BEHAVIOR')])
    expect(passed).toHaveLength(3); expect(stripped).toHaveLength(0)
  })
  it('❌ 미반영 영역(수상·자율동아리 등)은 제거', () => {
    const { passed, stripped } = filterActions([mk('AWARD'), mk('AUTONOMOUS_CLUB'), mk('SETUK')])
    expect(passed.map(p => p.recordArea)).toEqual(['SETUK'])
    expect(stripped).toHaveLength(2)
  })
  it('⛔ 금지 키워드 포함 텍스트는 제거', () => {
    const { passed, stripped } = filterActions([mk('SETUK', '소논문 작성을 추천')])
    expect(passed).toHaveLength(0); expect(stripped[0].reason).toContain('금지 키워드')
  })
  it('증거 없는 후보는 제거', () => {
    const bad = { ...mk('SETUK'), evidence: null }
    expect(filterActions([bad]).passed).toHaveLength(0)
  })
  it('⛔ 금지 키워드가 rationale에만 있어도 제거', () => {
    const bad: ActionCandidate = { recordArea: 'SETUK', competency: 'ACADEMIC', text: '깨끗한 텍스트', rationale: '컨설팅 받으라는 근거', evidence: { quote: 'q', section: 's' } }
    const { passed, stripped } = filterActions([bad])
    expect(passed).toHaveLength(0)
    expect(stripped[0].reason).toContain('금지 키워드')
  })
  it('⛔ 금지 키워드가 evidence.quote에만 있어도 제거', () => {
    const bad: ActionCandidate = { recordArea: 'SETUK', competency: 'ACADEMIC', text: '깨끗한 텍스트', rationale: '깨끗한 근거', evidence: { quote: '소논문 작성 실적', section: 's' } }
    const { passed, stripped } = filterActions([bad])
    expect(passed).toHaveLength(0)
    expect(stripped[0].reason).toContain('금지 키워드')
  })
  it('⛔ 띄어쓰기 변형(소 논문 / R & E / 교외 수상)도 제거', () => {
    const variants = ['소 논문 작성', 'R & E 프로젝트', '교외 수상 추천']
    for (const v of variants) {
      const { passed, stripped } = filterActions([mk('SETUK', v)])
      expect(passed).toHaveLength(0)
      expect(stripped[0].reason).toContain('금지 키워드')
    }
  })
  it('공백뿐인 증거인용은 throw하지 않고 제거', () => {
    const bad: ActionCandidate = { recordArea: 'SETUK', competency: 'ACADEMIC', text: '내용', rationale: 'r', evidence: { quote: '   ', section: 's' } }
    const { passed, stripped } = filterActions([bad])
    expect(passed).toHaveLength(0)
    expect(stripped[0].reason).toContain('증거인용 누락')
  })
  it('recordArea 양끝 공백은 trim 후 허용 판정', () => {
    const { passed, stripped } = filterActions([mk('SETUK ')])
    expect(passed).toHaveLength(1); expect(stripped).toHaveLength(0)
    expect(passed[0].recordArea).toBe('SETUK')
  })
  it('★불변식: 통과 결과에 금지 영역이 절대 없다', () => {
    const candidates = ['SETUK','AWARD','READING','BEHAVIOR','PRIVATE_EDU','CREATIVE_REGULAR'].map(a => mk(a))
    const { passed } = filterActions(candidates)
    for (const p of passed) expect(['SETUK','CREATIVE_REGULAR','BEHAVIOR']).toContain(p.recordArea)
  })
})
