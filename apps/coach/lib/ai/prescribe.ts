import 'server-only'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { StudentProfile } from '@pullim/shared'
import type { ActionCandidate, CohortResult } from '@pullim/engine'
import { anthropic, MODEL } from './client'
import { SYSTEM_PROMPT } from './system'
import { ActionCandidatesSchema } from './schemas'
import type { Diagnosis } from './schemas'

export async function prescribe(profile: StudentProfile, cohort: CohortResult, diagnosis: Diagnosis): Promise<ActionCandidate[]> {
  const res = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: zodOutputFormat(ActionCandidatesSchema) },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content:
        `코호트: ${cohort.system} / 세특가중: ${cohort.emphasizeSetuk} / 계열: ${profile.track5}\n` +
        `진단 약점: ${diagnosis.criteria.map(c => `${c.key}:${c.weakness}`).join(' / ')}\n\n` +
        `생기부(마스킹됨):\n${profile.saengbu}\n\n` +
        `약점을 보완할 "학생이 앞으로 할" 활동을 제안하라. recordArea는 SETUK·CREATIVE_REGULAR·BEHAVIOR만 사용하고, 각 후보에 생기부 인용(evidence)을 포함하라.`,
    }],
  })
  if (!res.parsed_output) throw new Error('처방 결과 파싱 실패')
  return res.parsed_output.candidates
}
