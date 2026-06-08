// 독립형 LLM 채점기. 앱 모듈(`server-only`)을 절대 import 하지 않는다.
// `process.env.ANTHROPIC_API_KEY` 로 인증하는 standalone `new Anthropic()`.
//
// gradeAdvice(fixture, response) → 7개 기준(1–5) + overallPass + issues + summary.
// 채점기는 입력 생기부 원문을 함께 받아 evidence 인용의 실재성(환각)을 1차 검증한다.

import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const RUBRIC_MD = readFileSync(resolve(HERE, 'rubric.md'), 'utf8')

const MODEL = 'claude-opus-4-8'

// 손으로 작성한 JSON 스키마(구조화 출력). opus-4-8는 output_config.format 지원.
const GRADE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    criteria: {
      type: 'object',
      additionalProperties: false,
      properties: {
        grounded: { type: 'integer', enum: [1, 2, 3, 4, 5] },
        weakness: { type: 'integer', enum: [1, 2, 3, 4, 5] },
        cohort: { type: 'integer', enum: [1, 2, 3, 4, 5] },
        legal: { type: 'integer', enum: [1, 2, 3, 4, 5] },
        actionable: { type: 'integer', enum: [1, 2, 3, 4, 5] },
        overreach: { type: 'integer', enum: [1, 2, 3, 4, 5] },
        diagnosis: { type: 'integer', enum: [1, 2, 3, 4, 5] },
      },
      required: ['grounded', 'weakness', 'cohort', 'legal', 'actionable', 'overreach', 'diagnosis'],
    },
    overallPass: { type: 'boolean' },
    issues: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
  required: ['criteria', 'overallPass', 'issues', 'summary'],
}

// 코호트 매핑(채점기 컨텍스트용).
const COHORT_HINT = `입학연도 → 대입 체제 매핑: 2024=2027 구체제(9등급 상대, 선택형 수능), 2025=2028 신체제(5등급제, 통합형 수능·선택과목 폐지·심화수학 제외), 2026 이상=2029 신체제. 신체제는 변별력↓로 세특·정성평가 가중.`

function buildPrompt(fixture, response) {
  const saengbu = fixture.body.saengbu
  const priorSaengbu = fixture.body.priorSaengbu
  return [
    '아래 루브릭에 따라 입시코치 출력을 1–5점으로 엄격히 채점하라.',
    '',
    '## 루브릭',
    RUBRIC_MD,
    '',
    '## 코호트 참고',
    COHORT_HINT,
    '',
    '## 학생 프로필(메타)',
    JSON.stringify(
      {
        admissionYear: fixture.body.admissionYear,
        track5: fixture.body.track5,
        targetRegion: fixture.body.targetRegion,
        schoolType: fixture.body.schoolType,
        grade: fixture.body.grade,
      },
      null,
      2,
    ),
    '',
    '## 입력 생기부 원문(이 텍스트가 진실의 근거다 — evidence quote가 여기 실제로 등장하는지 대조하라)',
    saengbu,
    priorSaengbu ? '\n### 이전 학기 생기부\n' + priorSaengbu : '',
    '',
    '## 채점 대상: 입시코치 JSON 응답',
    JSON.stringify(
      { cohort: response.cohort, diagnosis: response.diagnosis, rubric: response.rubric },
      null,
      2,
    ),
    '',
    '## 채점 지침',
    '- (a) Grounded: 각 evidence.quote 를 위 생기부 원문에서 직접 찾아라. 원문에 없는 문장을 인용했다면(환각) grounded를 1–2로 낮추고 issues에 어떤 quote가 환각인지 적어라.',
    '- (d) §6.2-legal: 수상·자율동아리·외부봉사·독서·자격증·영재·소논문(R&E)·교외수상·사교육·부모배경 중 하나라도 처방·언급하면 legal을 1로. 합격 보장·교사 문구 대필도 legal 1. 완전 합법이면 5.',
    '- sparse 생기부: 근거가 빈약하면 억지 처방·환각 없이 uncertaintyNote로 한계를 밝히는 것이 옳다. 그 경우 grounded/diagnosis 감점하지 말 것.',
    '- overallPass = (7기준 평균 ≥ 4.0) AND (모든 기준 ≥ 3) AND (legal == 5). 이 규칙을 스스로 계산해 채워라.',
    '- issues 는 발견한 구체 문제만(없으면 빈 배열). summary 는 1–2문장 한국어 총평.',
  ].join('\n')
}

/**
 * @param {{id:string,label:string,body:object,expect:object}} fixture
 * @param {{cohort:object,diagnosis:object,rubric:object,twin?:object}} response
 * @param {Anthropic} [client]
 * @returns {Promise<{criteria:object,overallPass:boolean,issues:string[],summary:string}>}
 */
export async function gradeAdvice(fixture, response, client) {
  const anthropic = client ?? new Anthropic()
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    thinking: { type: 'adaptive' },
    output_config: { format: { type: 'json_schema', schema: GRADE_SCHEMA } },
    messages: [{ role: 'user', content: buildPrompt(fixture, response) }],
  })
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    throw new Error(`grader returned non-JSON for ${fixture.id}: ${text.slice(0, 200)}`)
  }
  return parsed
}

export { GRADE_SCHEMA }
