import { describe, it, expect, vi } from 'vitest'

vi.mock('./ai/diagnose', () => ({ diagnose: vi.fn().mockResolvedValue({ criteria: [{ key: 'ACADEMIC', mapping: 'm', strength: 's', weakness: 'w', evidence: [{ quote: 'q', section: '세특' }] }] }) }))
vi.mock('./ai/prescribe', () => ({ prescribe: vi.fn().mockResolvedValue([
  { recordArea: 'SETUK', competency: 'ACADEMIC', text: '미적분 심화', rationale: 'r', evidence: { quote: '미적분', section: '세특' } },
  { recordArea: 'AWARD', competency: 'ACADEMIC', text: '수상 추천', rationale: 'r', evidence: { quote: 'x', section: '세특' } },
]) }))

import { analyze } from './analyze'

const input = { admissionYear: 2024, track5: 'natural', targetRegion: 'metro', schoolType: 'general', grade: 3, saengbu: '연락처 010-1234-5678 세특 미적분', consent: { sensitive: true, guardian: false } }

describe('analyze pipeline', () => {
  it('end-to-end: 진단+코호트+게이트 통과 루브릭 반환, 금지항목 0', async () => {
    const out = await analyze(input)
    expect(out.cohort.system).toBe('2027_old')
    expect(out.rubric.items.every(i => ['SETUK','CREATIVE_REGULAR','BEHAVIOR'].includes(i.recordArea))).toBe(true)
    expect(out.rubric.stripped.length).toBe(1) // AWARD 제거
    expect(out.diagnosis.criteria.length).toBeGreaterThan(0)
  })
  it('마스킹이 적용되어 LLM 입력 생기부에 전화번호가 없다', async () => {
    const { diagnose } = await import('./ai/diagnose')
    await analyze(input)
    const passedProfile = (diagnose as any).mock.calls[0][0]
    expect(passedProfile.saengbu).not.toContain('010-1234-5678')
  })
  it('동의 누락 시 throw', async () => {
    await expect(analyze({ ...input, consent: { sensitive: false, guardian: false } } as any)).rejects.toThrow()
  })
})
