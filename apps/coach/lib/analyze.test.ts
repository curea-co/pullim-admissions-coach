import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./ai/diagnose', () => ({ diagnose: vi.fn().mockResolvedValue({ criteria: [{ key: 'ACADEMIC', mapping: 'm', strength: 's', weakness: 'w', evidence: [{ quote: 'q', section: '세특' }] }] }) }))
vi.mock('./ai/prescribe', () => ({ prescribe: vi.fn().mockResolvedValue([
  { recordArea: 'SETUK', competency: 'ACADEMIC', text: '미적분 심화', rationale: 'r', evidence: { quote: '미적분', section: '세특' } },
  { recordArea: 'AWARD', competency: 'ACADEMIC', text: '수상 추천', rationale: 'r', evidence: { quote: 'x', section: '세특' } },
]) }))
vi.mock('./ai/twin-judge', () => ({ judgeLanded: vi.fn() }))

import { analyze } from './analyze'
import { judgeLanded } from './ai/twin-judge'

const input = { admissionYear: 2024, track5: 'natural', targetRegion: 'metro', schoolType: 'general', grade: 3, saengbu: '연락처 010-1234-5678 세특 미적분', consent: { sensitive: true, guardian: false } }

describe('analyze pipeline (single-term — 기존 동작 불변)', () => {
  it('end-to-end: 진단+코호트+게이트 통과 루브릭 반환, 금지항목 0', async () => {
    const out = await analyze(input)
    expect(out.cohort.system).toBe('2027_old')
    expect(out.rubric.items.every(i => ['SETUK','CREATIVE_REGULAR','BEHAVIOR'].includes(i.recordArea))).toBe(true)
    expect(out.rubric.stripped.length).toBe(1) // AWARD 제거
    expect(out.diagnosis.criteria.length).toBeGreaterThan(0)
    expect(out.twin).toBeUndefined() // priorSaengbu 없음 → twin 미생성
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

describe('analyze pipeline (two-term twin)', () => {
  beforeEach(() => (judgeLanded as any).mockReset())

  const twinInput = {
    ...input,
    saengbu: '이번학기 010-9999-0000 세특 통계',
    priorSaengbu: '이전학기 010-1111-2222 세특 미적분',
  }

  it('priorSaengbu 있으면 twin 정의, det=pending+judge=landed → 최종 landed로 병합', async () => {
    const { prescribe } = await import('./ai/prescribe')
    // prior 처방 액션은 SETUK '미적분 심화' 하나(AWARD는 게이트 제거).
    // current 처방 증거는 prior 액션과 토큰이 겹치지 않게(통계) 둬서 det=pending이 되도록 한다.
    // diagnose→prescribe 순서이므로 호출 0=prior, 1=current.
    ;(prescribe as any)
      .mockResolvedValueOnce([
        { recordArea: 'SETUK', competency: 'ACADEMIC', text: '미적분 심화', rationale: 'r', evidence: { quote: '미적분', section: '세특' } },
      ])
      .mockResolvedValueOnce([
        { recordArea: 'SETUK', competency: 'COMMUNITY', text: '동아리 발표', rationale: 'r', evidence: { quote: '동아리', section: '창체' } },
      ])
    ;(judgeLanded as any).mockResolvedValue({
      outcomes: [{ index: 0, landed: true, matchedQuote: '통계 단원을 미적분으로 확장 탐구함', rationale: 'ok' }],
    })
    const out = await analyze(twinInput)
    expect(out.twin).toBeDefined()
    expect(out.twin!.from).toBe('이전 학기')
    expect(out.twin!.to).toBe('이번 학기')
    expect(out.twin!.outcomes).toHaveLength(1)
    const o = out.twin!.outcomes[0]
    expect(o.status).toBe('landed')
    expect(o.matchedQuote).toBe('통계 단원을 미적분으로 확장 탐구함') // judge 인용 우선
    expect(out.twin!.summary.landed).toBe(1)
    expect(out.twin!.summary.pending).toBe(0)
    expect(out.twin!.summary.landedRate).toBe(1)
  })

  it('judge=pending이어도 det=landed면 landed 유지(det.matchedQuote 사용)', async () => {
    // prior·current 모두 동일 mock → 증거 '미적분'이 액션 '미적분 심화'와 겹쳐 det=landed.
    ;(judgeLanded as any).mockResolvedValue({
      outcomes: [{ index: 0, landed: false, matchedQuote: null, rationale: 'no' }],
    })
    const out = await analyze(twinInput)
    expect(out.twin).toBeDefined()
    const o = out.twin!.outcomes[0]
    expect(o.status).toBe('landed')
    expect(o.matchedQuote).not.toBeNull() // det baseline 인용
    expect(out.twin!.summary.landed).toBe(1)
  })

  it('두 학기 생기부 모두 마스킹 적용 — judge 입력 생기부에 전화번호 없음', async () => {
    ;(judgeLanded as any).mockResolvedValue({
      outcomes: [{ index: 0, landed: false, matchedQuote: null, rationale: 'no' }],
    })
    const { diagnose } = await import('./ai/diagnose')
    await analyze(twinInput)
    // judge에 넘긴 현재 생기부 = 3번째 인자.
    const judgeSaengbu = (judgeLanded as any).mock.calls[0][2] as string
    expect(judgeSaengbu).not.toContain('010-9999-0000')
    // prior 학기 진단에 넘어간 생기부에도 전화번호 없음(두 학기 모두 마스킹).
    const priorProfile = (diagnose as any).mock.calls.map((c: any) => c[0].saengbu)
    expect(priorProfile.some((s: string) => s.includes('010-1111-2222'))).toBe(false)
  })
})
