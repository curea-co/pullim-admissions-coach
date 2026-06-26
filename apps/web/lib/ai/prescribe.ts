import 'server-only'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { AnalysisInput } from '@pullim/shared'
import type { ActionCandidate, CohortResult } from '@pullim/engine'
import { anthropic, MODEL } from './client'
import { SYSTEM_PROMPT } from './system'
import { ActionCandidatesSchema } from './schemas'
import type { Diagnosis } from './schemas'

const REGION_LABEL: Record<CohortResult['region'], string> = {
  metro: '수도권',
  non_metro: '비수도권',
  unknown: '미정',
}

export async function prescribe(profile: AnalysisInput, cohort: CohortResult, diagnosis: Diagnosis): Promise<ActionCandidate[]> {
  const regionLabel = REGION_LABEL[cohort.region]
  const res = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: zodOutputFormat(ActionCandidatesSchema) },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content:
        `코호트: ${cohort.system} / 세특가중: ${cohort.emphasizeSetuk} / 계열: ${profile.track5} / 목표권역: ${regionLabel}\n` +
        `진단 약점: ${diagnosis.criteria.map(c => `${c.key}:${c.weakness}`).join(' / ')}\n\n` +
        `생기부(마스킹됨):\n${profile.saengbu}\n\n` +
        `약점을 보완할 "학생이 앞으로 할" 활동을 제안하라. recordArea는 SETUK·CREATIVE_REGULAR·BEHAVIOR만 사용하고, 각 후보에 생기부 인용(evidence)을 포함하라. ` +
        `목표권역이 미정이 아니면, 처방 중 최소 하나는 목표권역(${regionLabel})의 수시·정시 비중 차이에 따른 전략적 강조점을 반영하라(시스템 프롬프트의 권역별 전략 참조).`,
    }],
  })
  if (!res.parsed_output) throw new Error('처방 결과 파싱 실패')
  return res.parsed_output.candidates
}
