import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock is hoisted above module top-level consts → create mock fn via vi.hoisted.
const { parse } = vi.hoisted(() => ({ parse: vi.fn() }))
vi.mock('./client', () => ({ anthropic: { messages: { parse } }, MODEL: 'claude-opus-4-8' }))

import { judgeLanded } from './twin-judge'
import type { PrescribedAction, EvidenceRef } from '@pullim/engine'

const actions: PrescribedAction[] = [
  { recordArea: 'SETUK', competency: 'ACADEMIC', text: '미적분 심화 탐구', rationale: 'r', evidence: { quote: '미적분', section: '세특' } },
]
const evidence: EvidenceRef[] = [{ quote: '미적분 극한 단원을 추가 탐구함', section: '세특' }]

describe('judgeLanded', () => {
  beforeEach(() => parse.mockReset())

  it('parsed_output을 그대로 통과시킨다', async () => {
    parse.mockResolvedValue({
      parsed_output: { outcomes: [{ index: 0, landed: true, matchedQuote: '미적분 극한 단원을 추가 탐구함', rationale: '의미적으로 안착' }] },
    })
    const out = await judgeLanded(actions, evidence, '세특 미적분 극한 탐구')
    expect(out.outcomes[0].landed).toBe(true)
    expect(out.outcomes[0].matchedQuote).toBe('미적분 극한 단원을 추가 탐구함')
    expect(parse).toHaveBeenCalledOnce()
    // 판정 전용 모델 = claude-haiku-4-5
    expect((parse.mock.calls[0][0] as any).model).toBe('claude-haiku-4-5')
  })

  it('parsed_output null이면 throw', async () => {
    parse.mockResolvedValue({ parsed_output: null })
    await expect(judgeLanded(actions, evidence, '세특')).rejects.toThrow('파싱 실패')
  })
})
