import 'server-only'
import { z } from 'zod/v4'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { PrescribedAction, EvidenceRef } from '@pullim/engine'
import { anthropic } from './client'

/**
 * 종단 트윈 LLM judge — 결정론적 토큰 매처(diffSnapshots)가 놓치는 "한국어 의미적 안착"을 보완한다.
 *
 * 이전 학기 처방(PrescribedAction[])이 이번 학기 생기부에 실제로 반영됐는지를, 굴절/패러프레이즈를
 * 감안해 액션별로 yes/no + 인용으로 판정한다. landed일 때만 현재 생기부의 실제 문장(verbatim)을
 * matchedQuote로 돌려준다(근거 없는 landed 금지).
 *
 * 제약: 이 판정은 액션당 yes/no + 인용이라는 제약된 작업이므로 claude-haiku-4-5(저비용·고속)가 적합하다.
 *       no budget_tokens/temperature/thinking (Haiku 4.5 무지원), structured output만 사용, parsed_output null → throw.
 */

// 판정 전용 모델(제약된 액션별 yes/no + 인용 — opus보다 haiku가 비용·속도 면에서 적절).
const JUDGE_MODEL = 'claude-haiku-4-5'

export const TwinJudgeSchema = z.object({
  outcomes: z.array(
    z.object({
      index: z.number().int(), // prevSnapshot.actions 내 인덱스(순서 보존)
      landed: z.boolean(),
      matchedQuote: z.string().nullable(), // landed면 현재 생기부의 verbatim 문장, 아니면 null
      rationale: z.string(),
    }),
  ),
})
export type TwinJudgeResult = z.infer<typeof TwinJudgeSchema>

const JUDGE_SYSTEM = `당신은 한국 학생부종합전형(학종) 종단 코칭의 "안착 판정자"입니다.

이전 학기에 학생에게 처방한 활동 목록과, 이번 학기의 생활기록부(생기부, 마스킹됨)가 주어집니다.
각 처방 활동에 대해, 이번 학기 생기부의 근거가 그 활동을 학생이 실제로 수행했음을 의미적으로 반영하는지 판정하세요.

판정 규칙:
- 한국어 굴절·조사 변화·패러프레이즈를 감안하라(이것이 단순 토큰 매처가 놓치는 지점이다). 표현이 달라도 의미가 같으면 안착(landed)으로 본다.
- 단, 반드시 근거에 기반하라(grounded): 이번 학기 생기부에 그 활동의 수행을 뒷받침하는 실제 문장이 있을 때만 landed=true로 한다.
- landed=true이면 matchedQuote에 그 근거가 되는 이번 학기 생기부의 문장을 원문 그대로(verbatim) 한 문장 담아라.
- landed=false이면 matchedQuote는 null로 한다. 근거 없이 landed로 표시하지 말 것.
- 모든 처방 활동에 대해 정확히 하나의 결과를 index 순서대로 반환하라.`

export async function judgeLanded(
  actions: PrescribedAction[],
  currentEvidence: EvidenceRef[],
  currentSaengbu: string,
): Promise<TwinJudgeResult> {
  const actionList = actions
    .map((a, i) => `[${i}] (${a.recordArea}/${a.competency}) ${a.text}`)
    .join('\n')
  const evidenceList = currentEvidence.length
    ? currentEvidence.map((e) => `- (${e.section}) ${e.quote}`).join('\n')
    : '(관측된 인용 없음)'

  const res = await anthropic.messages.parse({
    model: JUDGE_MODEL,
    max_tokens: 16000,
    // NOTE: Haiku 4.5 does not support adaptive thinking (Opus/Sonnet-4.6 only) — sending it 400s.
    // Structured output (output_config.format) IS supported on Haiku 4.5; that's all the judge needs.
    output_config: { format: zodOutputFormat(TwinJudgeSchema) },
    system: [{ type: 'text', text: JUDGE_SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [
      {
        role: 'user',
        content:
          `## 이전 학기 처방 활동(index 순서)\n${actionList}\n\n` +
          `## 이번 학기 관측 인용(참고)\n${evidenceList}\n\n` +
          `## 이번 학기 생기부(마스킹됨)\n${currentSaengbu}\n\n` +
          `각 처방 활동이 이번 학기 생기부에 의미적으로 안착했는지 index 순서대로 판정하라.`,
      },
    ],
  })
  if (!res.parsed_output) throw new Error('트윈 판정 결과 파싱 실패')
  return res.parsed_output
}
