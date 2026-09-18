import 'server-only'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { AnalysisInput } from '@pullim/shared'
import type { CohortResult } from '@pullim/engine'
import { anthropic, MODEL } from './client'
import { SYSTEM_PROMPT } from './system'
import { DiagnosisSchema, type Diagnosis } from './schemas'

export async function diagnose(profile: AnalysisInput, cohort: CohortResult): Promise<Diagnosis> {
  const res = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    // NOTE: Haiku 4.5 는 adaptive thinking 과 output_config.effort 를 지원하지 않는다(보내면 400).
    // 구조화 출력(output_config.format)만 쓴다.
    output_config: { format: zodOutputFormat(DiagnosisSchema) },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content:
        `코호트: ${cohort.system} / 트랙: ${cohort.track} / 권역: ${cohort.region} / 세특가중: ${cohort.emphasizeSetuk}\n` +
        `계열: ${profile.track5} / 학년: ${profile.grade} / 학교유형: ${profile.schoolType}\n\n` +
        `생기부(마스킹됨):\n${profile.saengbu}\n\n` +
        `위 생기부를 학종 3역량(학업/진로/공동체)으로 진단하라. 각 항목에 강·약점과 생기부 인용을 포함하라.`,
    }],
  })
  if (!res.parsed_output) throw new Error('진단 결과 파싱 실패')
  return res.parsed_output
}
