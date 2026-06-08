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
  it('★불변식: 통과 결과에 금지 영역이 절대 없다', () => {
    const candidates = ['SETUK','AWARD','READING','BEHAVIOR','PRIVATE_EDU','CREATIVE_REGULAR'].map(a => mk(a))
    const { passed } = filterActions(candidates)
    for (const p of passed) expect(['SETUK','CREATIVE_REGULAR','BEHAVIOR']).toContain(p.recordArea)
  })
})
