// 입시코치 조언 품질 평가 오케스트레이터.
//
// 픽스처를 dev 서버(http://localhost:3031/api/analyze)에 POST → grader 채점 →
// (선택) baseline 비교 → 적대 판정 스위트 실행 → report.md / report.json 생성.
//
// 환경변수:
//   ANTHROPIC_API_KEY  (필수 — grader/baseline 의 standalone Anthropic 호출용)
//   EVAL_BASE_URL      (기본 http://localhost:3031)
//   EVAL_LIMIT         (기본 = 전체 픽스처 개수)
//   EVAL_BASELINE=1    (켜면 나이브 베이스라인 비교 수행 — 비용 추가)
//
// dev 서버는 별도로 키와 함께 띄운다. 서버/키가 없으면 크래시 대신 명확한 메시지로 종료한다.

import Anthropic from '@anthropic-ai/sdk'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { FIXTURES } from './fixtures.mjs'
import { gradeAdvice } from './grader.mjs'
import { naiveAdvice, compareAdvice } from './baseline.mjs'
import { JUDGE_CASES, evaluateJudge } from './adversarial-judge.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const BASE_URL = process.env.EVAL_BASE_URL ?? 'http://localhost:3031'
const ANALYZE_URL = `${BASE_URL}/api/analyze`
const DO_BASELINE = process.env.EVAL_BASELINE === '1'
const CRITERIA_KEYS = ['grounded', 'weakness', 'cohort', 'legal', 'actionable', 'overreach', 'diagnosis']

function die(msg) {
  console.error(`\n[eval] ${msg}\n`)
  process.exit(1)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 503(혼잡)에 대해 지수 백오프 재시도하는 fetch.
async function postAnalyze(body, { retries = 4 } = {}) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    let res
    try {
      res = await fetch(ANALYZE_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch (e) {
      // 연결 실패 = 서버 미기동. 즉시 명확히 종료.
      die(
        `dev 서버에 연결할 수 없습니다 (${ANALYZE_URL}).\n` +
          `먼저 키와 함께 서버를 띄우세요:\n` +
          `  ANTHROPIC_API_KEY=sk-... pnpm --filter @pullim/coach dev\n` +
          `원인: ${e instanceof Error ? e.message : String(e)}`,
      )
    }
    if (res.status === 503) {
      const wait = 1000 * 2 ** attempt
      console.warn(`  503 혼잡 — ${wait}ms 후 재시도 (${attempt + 1}/${retries})`)
      await sleep(wait)
      lastErr = new Error('503 overloaded')
      continue
    }
    let json
    try {
      json = await res.json()
    } catch {
      json = null
    }
    if (!res.ok) {
      return { ok: false, status: res.status, error: json?.error ?? `HTTP ${res.status}`, json: null }
    }
    return { ok: true, status: res.status, json, error: null }
  }
  return { ok: false, status: 503, error: lastErr?.message ?? '503 overloaded (재시도 소진)', json: null }
}

function mean(nums) {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    die(
      'ANTHROPIC_API_KEY 가 설정되지 않았습니다. grader/baseline 의 LLM 호출에 필요합니다.\n' +
        '예: ANTHROPIC_API_KEY=sk-... node apps/coach/eval/run.mjs',
    )
  }
  const client = new Anthropic() // standalone — server-only 미포함

  const limit = process.env.EVAL_LIMIT ? Number(process.env.EVAL_LIMIT) : FIXTURES.length
  const fixtures = FIXTURES.slice(0, limit)

  console.log(`[eval] base=${BASE_URL} fixtures=${fixtures.length}/${FIXTURES.length} baseline=${DO_BASELINE}`)
  console.log('[eval] 주의: 실제 API 호출 비용이 발생합니다.\n')

  const fixtureResults = []

  for (const fx of fixtures) {
    process.stdout.write(`• ${fx.id} … `)
    const resp = await postAnalyze(fx.body)
    if (!resp.ok) {
      console.log(`SKIP (analyze ${resp.status}: ${resp.error})`)
      fixtureResults.push({ id: fx.id, label: fx.label, ok: false, error: `analyze ${resp.status}: ${resp.error}` })
      continue
    }
    let grade
    try {
      grade = await gradeAdvice(fx, resp.json, client)
    } catch (e) {
      console.log(`SKIP (grader 오류: ${e instanceof Error ? e.message : String(e)})`)
      fixtureResults.push({ id: fx.id, label: fx.label, ok: false, error: `grader: ${e instanceof Error ? e.message : String(e)}` })
      continue
    }

    let compare = null
    if (DO_BASELINE) {
      try {
        const naive = await naiveAdvice(fx.body, client)
        compare = await compareAdvice(fx, resp.json, naive, client)
      } catch (e) {
        compare = { winner: 'tie', why: `비교 실패: ${e instanceof Error ? e.message : String(e)}` }
      }
    }

    const avg = round(mean(CRITERIA_KEYS.map((k) => grade.criteria[k])))
    console.log(`PASS=${grade.overallPass} avg=${avg}${compare ? ` vs baseline=${compare.winner}` : ''}`)
    fixtureResults.push({ id: fx.id, label: fx.label, ok: true, grade, avg, compare, note: fx.expect?.note })
  }

  // ── 적대 판정 스위트
  console.log('\n[eval] 적대 판정(twin judge) 스위트 …')
  const judgeResults = []
  for (const jc of JUDGE_CASES) {
    process.stdout.write(`• ${jc.id} … `)
    const resp = await postAnalyze(jc.body)
    if (!resp.ok) {
      console.log(`SKIP (analyze ${resp.status}: ${resp.error})`)
      judgeResults.push({ id: jc.id, label: jc.label, ok: false, error: `analyze ${resp.status}: ${resp.error}` })
      continue
    }
    if (!resp.json?.twin) {
      console.log('SKIP (twin 없음 — priorSaengbu 누락?)')
      judgeResults.push({ id: jc.id, label: jc.label, ok: false, error: 'no twin in response' })
      continue
    }
    const ev = evaluateJudge(resp.json.twin)
    console.log(`landed(FP)=${ev.landed}/${ev.total}`)
    judgeResults.push({ id: jc.id, label: jc.label, ok: true, ...ev, note: jc.expect?.note })
  }

  // ── 집계
  const graded = fixtureResults.filter((r) => r.ok)
  const aggregate = {}
  for (const k of CRITERIA_KEYS) {
    aggregate[k] = round(mean(graded.map((r) => r.grade.criteria[k])))
  }
  const overallMean = round(mean(graded.map((r) => r.avg)))
  const passCount = graded.filter((r) => r.grade.overallPass).length
  const passRate = graded.length ? round(passCount / graded.length) : 0

  let baselineWinRate = null
  if (DO_BASELINE) {
    const withCompare = graded.filter((r) => r.compare)
    const oursWins = withCompare.filter((r) => r.compare.winner === 'ours').length
    baselineWinRate = withCompare.length ? round(oursWins / withCompare.length) : 0
  }

  const judgeGraded = judgeResults.filter((r) => r.ok)
  const totalOutcomes = judgeGraded.reduce((a, r) => a + r.total, 0)
  const totalFP = judgeGraded.reduce((a, r) => a + r.landed, 0)
  const fpRate = totalOutcomes ? round(totalFP / totalOutcomes) : 0

  const topIssues = graded.flatMap((r) => (r.grade.issues ?? []).map((i) => `[${r.id}] ${i}`))

  // ── report.json
  const reportJson = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    baselineEnabled: DO_BASELINE,
    aggregate: {
      perCriterion: aggregate,
      overallMean,
      passCount,
      gradedCount: graded.length,
      passRate,
      baselineWinRate,
      judge: { cases: judgeGraded.length, totalOutcomes, falsePositives: totalFP, falsePositiveRate: fpRate },
    },
    fixtures: fixtureResults,
    judge: judgeResults,
    topIssues,
  }
  writeFileSync(resolve(HERE, 'report.json'), JSON.stringify(reportJson, null, 2))

  // ── report.md
  const md = buildMarkdown(reportJson)
  writeFileSync(resolve(HERE, 'report.md'), md)

  // ── stdout 요약
  console.log('\n──────── 요약 ────────')
  console.log(`채점 케이스: ${graded.length}/${fixtureResults.length}`)
  console.log(`PASS rate: ${passRate} (${passCount}/${graded.length})`)
  console.log(`전체 평균: ${overallMean}`)
  console.log(`기준별: ${CRITERIA_KEYS.map((k) => `${k}=${aggregate[k]}`).join(' ')}`)
  if (baselineWinRate !== null) console.log(`baseline 대비 우리 승률: ${baselineWinRate}`)
  console.log(`judge false-positive rate: ${fpRate} (${totalFP}/${totalOutcomes})`)
  console.log(`report → apps/coach/eval/report.md, report.json`)
}

function buildMarkdown(r) {
  const a = r.aggregate
  const lines = []
  lines.push('# 입시코치 조언 품질 리포트', '')
  lines.push(`- 생성: ${r.generatedAt}`)
  lines.push(`- base URL: ${r.baseUrl}`)
  lines.push(`- baseline 비교: ${r.baselineEnabled ? 'ON' : 'OFF'}`)
  lines.push('')
  lines.push('## 집계')
  lines.push('')
  lines.push(`- 채점 케이스: ${a.gradedCount}`)
  lines.push(`- **PASS rate: ${a.passRate}** (${a.passCount}/${a.gradedCount})`)
  lines.push(`- 전체 평균: ${a.overallMean}`)
  if (a.baselineWinRate !== null) lines.push(`- baseline 대비 우리 승률: ${a.baselineWinRate}`)
  lines.push(
    `- judge false-positive rate: **${a.judge.falsePositiveRate}** (${a.judge.falsePositives}/${a.judge.totalOutcomes} outcomes, ${a.judge.cases} cases)`,
  )
  lines.push('')
  lines.push('### 기준별 평균 (1–5)')
  lines.push('')
  lines.push('| grounded | weakness | cohort | legal | actionable | overreach | diagnosis |')
  lines.push('|---|---|---|---|---|---|---|')
  const c = a.perCriterion
  lines.push(`| ${c.grounded} | ${c.weakness} | ${c.cohort} | ${c.legal} | ${c.actionable} | ${c.overreach} | ${c.diagnosis} |`)
  lines.push('')

  lines.push('## 케이스별 점수')
  lines.push('')
  lines.push('| id | PASS | avg | grnd | weak | cohort | legal | actn | ovr | diag |' + (r.baselineEnabled ? ' vs baseline |' : ''))
  lines.push('|---|---|---|---|---|---|---|---|---|---|' + (r.baselineEnabled ? '---|' : ''))
  for (const f of r.fixtures) {
    if (!f.ok) {
      lines.push(`| ${f.id} | ERR | — | — | — | — | — | — | — | — |` + (r.baselineEnabled ? ' — |' : '') + ` ${f.error}`)
      continue
    }
    const g = f.grade.criteria
    lines.push(
      `| ${f.id} | ${f.grade.overallPass ? '✅' : '❌'} | ${f.avg} | ${g.grounded} | ${g.weakness} | ${g.cohort} | ${g.legal} | ${g.actionable} | ${g.overreach} | ${g.diagnosis} |` +
        (r.baselineEnabled ? ` ${f.compare?.winner ?? '—'} |` : ''),
    )
  }
  lines.push('')

  lines.push('## 적대 판정(twin judge) 스위트')
  lines.push('')
  lines.push('설계상 모든 outcome 은 `pending` 이 정답. `landed` = false positive 후보.')
  lines.push('')
  lines.push('| id | total | landed(FP) | note |')
  lines.push('|---|---|---|---|')
  for (const j of r.judge) {
    if (!j.ok) {
      lines.push(`| ${j.id} | — | — | ERR: ${j.error} |`)
      continue
    }
    lines.push(`| ${j.id} | ${j.total} | ${j.landed} | ${(j.note ?? '').replace(/\|/g, '/')} |`)
  }
  lines.push('')
  // FP 상세
  const fps = r.judge.filter((j) => j.ok && j.landed > 0)
  if (fps.length) {
    lines.push('### False-positive 상세')
    lines.push('')
    for (const j of fps) {
      for (const fp of j.falsePositiveCandidates) {
        lines.push(`- **${j.id}**: "${fp.actionText}" ← matchedQuote="${fp.matchedQuote}" (score=${fp.score})`)
      }
    }
    lines.push('')
  }

  lines.push('## Top issues')
  lines.push('')
  if (r.topIssues.length === 0) lines.push('_없음_')
  else for (const i of r.topIssues) lines.push(`- ${i}`)
  lines.push('')

  return lines.join('\n')
}

main().catch((e) => die(e instanceof Error ? e.stack ?? e.message : String(e)))
