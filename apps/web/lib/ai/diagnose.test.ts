import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock is hoisted above module top-level consts, so the mock fn must be
// created via vi.hoisted to avoid a TDZ ReferenceError in the factory closure.
const { parse } = vi.hoisted(() => ({ parse: vi.fn() }))
vi.mock('./client', () => ({ anthropic: { messages: { parse } }, MODEL: 'claude-opus-4-8' }))

import { diagnose } from './diagnose'
import { resolveCohort } from '@pullim/engine'

const profile = { admissionYear: 2025, track5: 'natural', targetRegion: 'metro', schoolType: 'general', grade: 2, saengbu: '세특...', consent: { sensitive: true, guardian: false } } as const

describe('diagnose adapter', () => {
  beforeEach(() => parse.mockReset())
  it('parsed_output을 그대로 반환', async () => {
    parse.mockResolvedValue({ parsed_output: { criteria: [{ key: 'ACADEMIC', mapping: 'm', strength: 's', weakness: 'w', evidence: [{ quote: 'q', section: '세특' }] }] } })
    const out = await diagnose(profile, resolveCohort(2025, 'metro'))
    expect(out.criteria[0].key).toBe('ACADEMIC')
    expect(parse).toHaveBeenCalledOnce()
  })
  it('parsed_output null이면 throw', async () => {
    parse.mockResolvedValue({ parsed_output: null })
    await expect(diagnose(profile, resolveCohort(2025, 'metro'))).rejects.toThrow('파싱 실패')
  })
})
