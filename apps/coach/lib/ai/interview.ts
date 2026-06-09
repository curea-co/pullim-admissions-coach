import 'server-only'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { StudentProfile } from '@pullim/shared'
import type { CohortResult } from '@pullim/engine'
import { anthropic, MODEL } from './client'
import { SYSTEM_PROMPT } from './system'
import { InterviewPackSchema, type InterviewPack, type Diagnosis } from './schemas'

/**
 * 면접 준비 팩 (1 LLM call).
 *
 * ★ 정직성:
 * - 답변 "방향"(핵심 포인트·논리)만 제공. 완성 대본·"합격 답변" 절대 금지.
 * - 모든 예상질문은 입력 생기부에 실제 등장하는 근거(basis 인용)에 묶인다. 인용 날조 금지.
 * - 학년 적응: 고3=실전 모의 질문, 고1–2=감 잡기/방향 설정.
 *
 * 생기부는 analyze 단계에서 이미 마스킹되어 들어온다(여기서 추가 마스킹하지 않음).
 */
export async function interviewPack(
  profile: StudentProfile,
  cohort: CohortResult,
  diagnosis: Diagnosis,
): Promise<InterviewPack> {
  const stage =
    profile.grade >= 3
      ? '고3 실전 모드: 실제 학종 면접에서 나올 법한 압축적·구체적 예상질문으로 구성하라.'
      : '고1–2 감 잡기 모드: 면접의 결을 익히고 앞으로 무엇을 준비할지 방향을 잡도록 질문을 구성하라.'

  const res = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: zodOutputFormat(InterviewPackSchema) },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content:
        `코호트: ${cohort.system} / 계열: ${profile.track5} / 학년: ${profile.grade} / 학교유형: ${profile.schoolType}\n` +
        `진단 요약: ${diagnosis.criteria.map(c => `${c.key}:${c.strength}`).join(' / ')}\n\n` +
        `생기부(마스킹됨):\n${profile.saengbu}\n\n` +
        `위 생기부 근거에 기반한 학종 면접 예상질문 3–5개를 만들어라.\n` +
        `각 질문은 다음을 포함한다:\n` +
        `- question: 예상 면접 질문\n` +
        `- basis: 그 질문의 근거가 된 실제 생기부 항목(생기부 원문에 등장하는 인용 quote + section). 생기부에 없는 인용을 지어내지 말 것.\n` +
        `- answerDirection: 답변의 *방향*(핵심 포인트·논리 전개)만. 완성 대본/예시 문장/"합격 답변"을 작성하지 말 것. 학생이 자기 경험으로 채울 수 있게 뼈대만 제시.\n` +
        `- followups: 예상 꼬리질문\n\n` +
        `${stage}`,
    }],
  })
  if (!res.parsed_output) throw new Error('면접 준비 팩 파싱 실패')
  return res.parsed_output
}
