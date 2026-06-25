import { describe, it, expect, vi, beforeEach } from 'vitest'

const { parse } = vi.hoisted(() => ({ parse: vi.fn() }))
vi.mock('./client', () => ({ anthropic: { messages: { parse } }, MODEL: 'claude-opus-4-8' }))

import { interviewPack } from './interview'
import { resolveCohort } from '@pullim/engine'
import type { Diagnosis } from './schemas'

const profile = { admissionYear: 2025, track5: 'natural', targetRegion: 'metro', schoolType: 'general', grade: 3, saengbu: '세특 미적분 탐구', consent: { sensitive: true, guardian: false } } as const
const diagnosis: Diagnosis = { criteria: [{ key: 'ACADEMIC', mapping: 'm', strength: 's', weakness: 'w', evidence: [{ quote: '미적분', section: '세특' }] }] }

describe('interviewPack adapter', () => {
  beforeEach(() => parse.mockReset())
  it('parsed_output을 그대로 반환', async () => {
    const pack = { questions: [
      { question: '미적분 탐구에서 가장 어려웠던 점은?', basis: { quote: '미적분', section: '세특' }, answerDirection: '핵심 포인트만', followups: ['그래서 어떻게 해결했나요?'] },
      { question: 'q2', basis: { quote: '미적분', section: '세특' }, answerDirection: 'd2', followups: [] },
      { question: 'q3', basis: { quote: '미적분', section: '세특' }, answerDirection: 'd3', followups: [] },
    ] }
    parse.mockResolvedValue({ parsed_output: pack })
    const out = await interviewPack(profile, resolveCohort(2025, 'metro'), diagnosis)
    expect(out.questions).toHaveLength(3)
    expect(out.questions[0].basis.quote).toBe('미적분')
    expect(parse).toHaveBeenCalledOnce()
  })
  it('parsed_output null이면 throw', async () => {
    parse.mockResolvedValue({ parsed_output: null })
    await expect(interviewPack(profile, resolveCohort(2025, 'metro'), diagnosis)).rejects.toThrow('파싱 실패')
  })
})
