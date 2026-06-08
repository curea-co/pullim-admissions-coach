// 나이브 베이스라인 + 사이드바이사이드 비교.
// 앱 모듈을 import 하지 않는 standalone Anthropic 호출.
//
// naiveAdvice(body): 코호트·합법성·증거 스캐폴딩이 전혀 없는 순진한 프롬프트로 자유 텍스트 조언 생성.
// compareAdvice(fixture, ours, naiveText): 루브릭 기준으로 둘 중 무엇이 더 나은지 판정.

import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const RUBRIC_MD = readFileSync(resolve(HERE, 'rubric.md'), 'utf8')
const MODEL = 'claude-opus-4-8'

/**
 * 순진한 조언: 스캐폴딩 없음. "이 생기부를 보고 학종 입시 조언을 해줘".
 * @param {object} body StudentProfile-ish (saengbu 사용)
 * @param {Anthropic} [client]
 * @returns {Promise<string>}
 */
export async function naiveAdvice(body, client) {
  const anthropic = client ?? new Anthropic()
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    thinking: { type: 'adaptive' },
    messages: [
      {
        role: 'user',
        content: `이 생기부를 보고 학종 입시 조언을 해줘.\n\n${body.saengbu}`,
      },
    ],
  })
  return msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
}

const COMPARE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    winner: { type: 'string', enum: ['ours', 'baseline', 'tie'] },
    why: { type: 'string' },
  },
  required: ['winner', 'why'],
}

/**
 * 우리 구조화 처방 vs 나이브 자유텍스트를 루브릭 기준으로 비교.
 * @param {object} fixture
 * @param {object} ours /api/analyze JSON
 * @param {string} naiveText
 * @param {Anthropic} [client]
 * @returns {Promise<{winner:'ours'|'baseline'|'tie', why:string}>}
 */
export async function compareAdvice(fixture, ours, naiveText, client) {
  const anthropic = client ?? new Anthropic()
  const prompt = [
    '두 학종 조언을 아래 루브릭 기준으로 비교하고 어느 쪽이 더 나은지 판정하라.',
    '특히 (a)근거실재성 (d)§6.2합법성 (e)구체성 을 중시하라. 금지항목(수상·외부봉사·독서·소논문·자율동아리·학원)을 권유한 쪽은 그 자체로 크게 불리하다.',
    '',
    '## 루브릭',
    RUBRIC_MD,
    '',
    '## 입력 생기부',
    fixture.body.saengbu,
    '',
    '## A안 (ours — 구조화 진단/처방)',
    JSON.stringify({ diagnosis: ours.diagnosis, rubric: ours.rubric }, null, 2),
    '',
    '## B안 (baseline — 나이브 자유텍스트)',
    naiveText,
    '',
    'winner 는 ours | baseline | tie. why 는 1–2문장 근거(한국어).',
  ].join('\n')

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    thinking: { type: 'adaptive' },
    output_config: { format: { type: 'json_schema', schema: COMPARE_SCHEMA } },
    messages: [{ role: 'user', content: prompt }],
  })
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
  return JSON.parse(text)
}
