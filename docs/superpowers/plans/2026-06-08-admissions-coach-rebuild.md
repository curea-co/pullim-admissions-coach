# 입시코치 전면 재구현 (수직 슬라이스) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 `apps/web`를 그대로 둔 채, 폐쇄루프(진단→처방→증명) 엣지를 구현한 새 앱 `apps/coach`와 결정적 해자 패키지 `packages/engine`를 만들고 실제 Claude를 연동해 end-to-end로 작동시킨다.

**Architecture:** 3레이어 — (1) `packages/engine` 순수 결정적 TS(코호트 판정·§6.2 합법성 게이트·루브릭 조립·증거인용, 네트워크 0, 골든 회귀로 보호), (2) `apps/coach/lib/ai` Claude 어댑터(구조화 출력·프롬프트 캐싱), (3) `apps/coach` Next 16 루프 UI + `/api/analyze` 오케스트레이션. 합법성·코호트 정확도는 engine에서 증명되어 모델 교체에 무관.

**Tech Stack:** pnpm 워크스페이스, TypeScript 5.5, Next 16(App Router)+React 19, Tailwind v4, zod 3, `@anthropic-ai/sdk`(`claude-opus-4-8`, adaptive thinking, `effort:high`, `messages.parse`+`zodOutputFormat`), vitest.

> 근거 SSOT: `docs/superpowers/specs/2026-06-08-admissions-coach-rebuild-design.md`, `docs/010_..._definition_v0.4.md`(§6 가드레일·§7 코호트), `docs/012_policy_cohort_spec_v0.1.md`, `docs/013_rubric_engine_spec_v0.1.md`, `docs/golden/`.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `packages/engine/package.json` · `tsconfig.json` · `vitest.config.ts` | 순수 TS 패키지 설정 |
| `packages/engine/src/types.ts` | 공통 타입·enum(RecordArea·Competency·CohortSystem 등) |
| `packages/engine/src/cohort.ts` | 입학연도→체제·트랙·권역 (결정적) |
| `packages/engine/src/legality.ts` | §6.2 화이트리스트 게이트(❌/⛔ 제거) |
| `packages/engine/src/evidence.ts` | 증거인용·불확실성 검증 |
| `packages/engine/src/rubric.ts` | 합법 액션 루브릭 조립 |
| `packages/engine/src/index.ts` | 공개 API 배럴 |
| `packages/engine/src/*.test.ts` | 단위 테스트(결정적) |
| `packages/engine/src/golden/*.ts` · `golden.test.ts` | 골든 회귀(5케이스+코호트) |
| `packages/shared/src/profile.ts` | StudentProfile zod 스키마 |
| `apps/coach/*` (config) | Next 16 + Tailwind v4 앱 셸 |
| `apps/coach/lib/mask.ts` | 결정적 PII 마스킹 |
| `apps/coach/lib/ai/schemas.ts` | Diagnosis·ActionCandidates zod |
| `apps/coach/lib/ai/system.ts` | 한국어 도메인 시스템프롬프트 |
| `apps/coach/lib/ai/client.ts` · `diagnose.ts` · `prescribe.ts` | Claude 어댑터 |
| `apps/coach/app/api/analyze/route.ts` | 파이프라인 오케스트레이션 |
| `apps/coach/app/(loop)/intake/page.tsx` | 입력 폼 + §23 동의 게이트 |
| `apps/coach/app/(loop)/page.tsx` · `components/*` | 루프 4단계 UI |

---

## Task 0: 워크스페이스 스캐폴딩 (engine + coach 셸)

**Files:**
- Create: `packages/engine/package.json`, `packages/engine/tsconfig.json`, `packages/engine/vitest.config.ts`, `packages/engine/src/index.ts`
- Modify: `package.json`(root scripts)

- [ ] **Step 1: engine 패키지 생성**

Create `packages/engine/package.json`:
```json
{
  "name": "@pullim/engine",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": { "@pullim/shared": "workspace:*", "zod": "^3.23.8" },
  "devDependencies": { "typescript": "5.5.4", "vitest": "^2.1.4" }
}
```

Create `packages/engine/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
    "strict": true, "skipLibCheck": true, "noEmit": true,
    "esModuleInterop": true, "types": ["vitest/globals"]
  },
  "include": ["src"]
}
```

Create `packages/engine/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { globals: true, include: ['src/**/*.test.ts'] } })
```

Create `packages/engine/src/index.ts`:
```ts
export * from './types'
export * from './cohort'
export * from './legality'
export * from './evidence'
export * from './rubric'
```

- [ ] **Step 2: 의존성 설치**

Run: `pnpm install`
Expected: engine·shared 링크 완료, lockfile 갱신.

- [ ] **Step 3: 루트 스크립트 추가**

Modify `package.json` scripts에 추가:
```json
"test:engine": "pnpm --filter @pullim/engine test",
"dev:coach": "pnpm --filter @pullim/coach dev"
```

- [ ] **Step 4: 커밋**
```bash
git add package.json pnpm-lock.yaml packages/engine
git commit -m "chore(engine): scaffold pure deterministic engine package"
```

---

## Task 1: 공통 타입 + StudentProfile 스키마

**Files:**
- Create: `packages/engine/src/types.ts`, `packages/shared/src/profile.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/profile.test.ts` (vitest via engine config 공유 — shared에도 vitest 추가)

- [ ] **Step 1: 타입 정의 작성**

Create `packages/engine/src/types.ts`:
```ts
/** §6.2 대입-반영 = 처방 허용 영역 (이것만 RecordArea로 인정) */
export type AllowedRecordArea = 'SETUK' | 'CREATIVE_REGULAR' | 'BEHAVIOR'
export const ALLOWED_RECORD_AREAS: readonly AllowedRecordArea[] = ['SETUK', 'CREATIVE_REGULAR', 'BEHAVIOR']

/** ❌ 미반영 + ⛔ 미기재 = 처방/언급 금지 (LLM이 제안하면 게이트가 제거) */
export const FORBIDDEN_RECORD_AREAS = [
  'AWARD', 'AUTONOMOUS_CLUB', 'VOLUNTEER_EXTERNAL', 'READING', 'CERTIFICATE', 'GIFTED',
  'RESEARCH_PAPER', 'EXTERNAL_AWARD', 'PRIVATE_EDU', 'PARENT_BACKGROUND',
] as const

/** ⛔ 언급 자체 금지 키워드(텍스트 스캔용) */
export const FORBIDDEN_KEYWORDS = ['소논문', 'R&E', '교외 수상', '학원', '컨설팅'] as const

export type Competency = 'ACADEMIC' | 'CAREER' | 'COMMUNITY'
export type CohortSystem = '2027_old' | '2028_new' | '2029_new'
export type Track = 'beachhead' | 'core'
export type Region = 'metro' | 'non_metro' | 'unknown'

export interface CohortResult {
  system: CohortSystem
  track: Track
  region: Region
  /** 신체제 정성평가 가중(세특 우선) 여부 */
  emphasizeSetuk: boolean
}

export interface EvidenceRef { quote: string; section: string }

/** LLM이 제안하는 처방 후보(검증 전) */
export interface ActionCandidate {
  recordArea: string // 임의 문자열 — 게이트가 검증
  competency: Competency
  text: string
  rationale: string
  evidence: EvidenceRef | null
}

/** 게이트 통과 + 조립된 합법 처방 */
export interface PrescribedAction {
  recordArea: AllowedRecordArea
  competency: Competency
  text: string
  rationale: string
  evidence: EvidenceRef
}

export interface Rubric {
  cohort: CohortResult
  items: PrescribedAction[]
  uncertaintyNote: string
  stripped: { recordArea: string; reason: string }[]
}
```

- [ ] **Step 2: shared에 vitest 추가 + 실패 테스트 작성**

Modify `packages/shared/package.json` devDependencies에 `"vitest": "^2.1.4"` 추가, scripts에 `"test": "vitest run"` 추가. Create `packages/shared/vitest.config.ts`(engine과 동일 내용).

Create `packages/shared/src/profile.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { StudentProfileSchema } from './profile'

describe('StudentProfileSchema', () => {
  const base = {
    admissionYear: 2024, track5: 'natural', targetRegion: 'metro',
    schoolType: 'general', grade: 3, saengbu: '세특: 미적분 탐구...',
    consent: { sensitive: true, guardian: false },
  }
  it('accepts a valid profile', () => {
    expect(StudentProfileSchema.parse(base).admissionYear).toBe(2024)
  })
  it('rejects missing admissionYear', () => {
    const { admissionYear, ...rest } = base
    expect(() => StudentProfileSchema.parse(rest)).toThrow()
  })
  it('rejects sensitive consent !== true', () => {
    expect(() => StudentProfileSchema.parse({ ...base, consent: { sensitive: false, guardian: false } })).toThrow()
  })
})
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `pnpm --filter @pullim/shared test`
Expected: FAIL — `profile.ts` 없음.

- [ ] **Step 4: 스키마 구현**

Create `packages/shared/src/profile.ts`:
```ts
import { z } from 'zod'

export const StudentProfileSchema = z.object({
  admissionYear: z.number().int().min(2024).max(2030),
  track5: z.enum(['humanities', 'social', 'natural', 'engineering', 'arts_athletics']),
  targetRegion: z.enum(['metro', 'non_metro', 'unknown']),
  schoolType: z.enum(['general', 'autonomous', 'special_purpose', 'vocational']),
  grade: z.number().int().min(1).max(3),
  saengbu: z.string().min(1, '생기부 내용이 필요합니다'),
  consent: z.object({
    sensitive: z.literal(true), // §23 민감정보 별도 동의 필수
    guardian: z.boolean(),      // 만14세 미만 시 true 요구(라우트에서 검사)
  }),
})
export type StudentProfile = z.infer<typeof StudentProfileSchema>
```

Modify `packages/shared/src/index.ts`에 추가: `export * from './profile'`

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm --filter @pullim/shared test`
Expected: PASS (3 tests).

- [ ] **Step 6: 커밋**
```bash
git add packages/engine/src/types.ts packages/shared
git commit -m "feat(engine,shared): core types + StudentProfile schema with §23 consent"
```

---

## Task 2: 코호트 판정 (결정적, [D] §7)

**Files:**
- Create: `packages/engine/src/cohort.ts`, `packages/engine/src/cohort.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

Create `packages/engine/src/cohort.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { resolveCohort } from './cohort'

describe('resolveCohort', () => {
  it('2024 입학 → 2027 구체제(비치헤드)', () => {
    const r = resolveCohort(2024, 'metro')
    expect(r.system).toBe('2027_old'); expect(r.track).toBe('beachhead'); expect(r.emphasizeSetuk).toBe(false)
  })
  it('2025 입학 → 2028 신체제(코어, 세특 가중)', () => {
    const r = resolveCohort(2025, 'non_metro')
    expect(r.system).toBe('2028_new'); expect(r.track).toBe('core'); expect(r.emphasizeSetuk).toBe(true)
  })
  it('2026 입학 → 2029 신체제(코어)', () => {
    expect(resolveCohort(2026, 'unknown').system).toBe('2029_new')
  })
  it('권역을 보존한다', () => {
    expect(resolveCohort(2024, 'non_metro').region).toBe('non_metro')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @pullim/engine test -- cohort`
Expected: FAIL — `resolveCohort` 없음.

- [ ] **Step 3: 구현**

Create `packages/engine/src/cohort.ts`:
```ts
import type { CohortResult, CohortSystem, Region } from './types'

/** 고교 입학연도 → 대입 체제. [D] §7: 2024입학=2027구체제, 2025=2028신체제, 2026+=2029신체제 */
export function resolveCohort(admissionYear: number, region: Region): CohortResult {
  let system: CohortSystem
  if (admissionYear <= 2024) system = '2027_old'
  else if (admissionYear === 2025) system = '2028_new'
  else system = '2029_new'
  const isNew = system !== '2027_old'
  return {
    system,
    track: isNew ? 'core' : 'beachhead',
    region,
    emphasizeSetuk: isNew, // 신체제 내신 5등급제 → 변별력↓ → 세특 정성평가 가중 ([R] §3.2)
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @pullim/engine test -- cohort`
Expected: PASS (4 tests).

- [ ] **Step 5: 커밋**
```bash
git add packages/engine/src/cohort.ts packages/engine/src/cohort.test.ts
git commit -m "feat(engine): deterministic cohort resolution (2027 old / 2028·2029 new)"
```

---

## Task 3: 합법성 게이트 (§6.2 화이트리스트, ❌/⛔ 0건 보증)

**Files:**
- Create: `packages/engine/src/legality.ts`, `packages/engine/src/legality.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

Create `packages/engine/src/legality.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { filterActions } from './legality'
import type { ActionCandidate } from './types'

const mk = (recordArea: string, text = '내용', evidence = { quote: 'q', section: 's' }): ActionCandidate =>
  ({ recordArea, competency: 'ACADEMIC', text, rationale: 'r', evidence })

describe('filterActions', () => {
  it('✅ 허용 영역은 통과', () => {
    const { passed, stripped } = filterActions([mk('SETUK'), mk('CREATIVE_REGULAR'), mk('BEHAVIOR')])
    expect(passed).toHaveLength(3); expect(stripped).toHaveLength(0)
  })
  it('❌ 미반영 영역(수상·자율동아리 등)은 제거', () => {
    const { passed, stripped } = filterActions([mk('AWARD'), mk('AUTONOMOUS_CLUB'), mk('SETUK')])
    expect(passed.map(p => p.recordArea)).toEqual(['SETUK'])
    expect(stripped).toHaveLength(2)
  })
  it('⛔ 금지 키워드 포함 텍스트는 제거', () => {
    const { passed, stripped } = filterActions([mk('SETUK', '소논문 작성을 추천')])
    expect(passed).toHaveLength(0); expect(stripped[0].reason).toContain('금지 키워드')
  })
  it('증거 없는 후보는 제거', () => {
    const bad = { ...mk('SETUK'), evidence: null }
    expect(filterActions([bad]).passed).toHaveLength(0)
  })
  it('★불변식: 통과 결과에 금지 영역이 절대 없다', () => {
    const candidates = ['SETUK','AWARD','READING','BEHAVIOR','PRIVATE_EDU','CREATIVE_REGULAR'].map(a => mk(a))
    const { passed } = filterActions(candidates)
    for (const p of passed) expect(['SETUK','CREATIVE_REGULAR','BEHAVIOR']).toContain(p.recordArea)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @pullim/engine test -- legality`
Expected: FAIL — `filterActions` 없음.

- [ ] **Step 3: 구현**

Create `packages/engine/src/legality.ts`:
```ts
import { ALLOWED_RECORD_AREAS, FORBIDDEN_KEYWORDS, type ActionCandidate, type AllowedRecordArea, type PrescribedAction } from './types'

export interface LegalityResult {
  passed: PrescribedAction[]
  stripped: { recordArea: string; reason: string }[]
}

const isAllowed = (a: string): a is AllowedRecordArea =>
  (ALLOWED_RECORD_AREAS as readonly string[]).includes(a)

/** 최후 안전망: LLM이 무엇을 제안하든 §6.2 ✅ 영역 + 증거 있는 것만 통과. 금지항목 산출 0건 보증. */
export function filterActions(candidates: ActionCandidate[]): LegalityResult {
  const passed: PrescribedAction[] = []
  const stripped: { recordArea: string; reason: string }[] = []
  for (const c of candidates) {
    if (!isAllowed(c.recordArea)) { stripped.push({ recordArea: c.recordArea, reason: '대입 미반영/미기재 영역(§6.2 ❌·⛔)' }); continue }
    const hit = FORBIDDEN_KEYWORDS.find(k => c.text.includes(k) || c.rationale.includes(k))
    if (hit) { stripped.push({ recordArea: c.recordArea, reason: `금지 키워드 포함: ${hit}` }); continue }
    if (!c.evidence) { stripped.push({ recordArea: c.recordArea, reason: '증거인용 누락' }); continue }
    passed.push({ recordArea: c.recordArea, competency: c.competency, text: c.text, rationale: c.rationale, evidence: c.evidence })
  }
  return { passed, stripped }
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @pullim/engine test -- legality`
Expected: PASS (5 tests).

- [ ] **Step 5: 커밋**
```bash
git add packages/engine/src/legality.ts packages/engine/src/legality.test.ts
git commit -m "feat(engine): §6.2 legality gate — forbidden-area/keyword/no-evidence stripped, 0 leak"
```

---

## Task 4: 증거인용·불확실성 검증

**Files:**
- Create: `packages/engine/src/evidence.ts`, `packages/engine/src/evidence.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

Create `packages/engine/src/evidence.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { assertCited, buildUncertaintyNote } from './evidence'
import type { PrescribedAction } from './types'

const action = (q: string): PrescribedAction =>
  ({ recordArea: 'SETUK', competency: 'ACADEMIC', text: 't', rationale: 'r', evidence: { quote: q, section: '세특' } })

describe('evidence', () => {
  it('모든 액션이 인용을 가지면 통과', () => {
    expect(assertCited([action('미적분 보고서')])).toBe(true)
  })
  it('빈 인용은 거부', () => {
    expect(() => assertCited([action('')])).toThrow()
  })
  it('불확실성 노트는 단정형이 아니다', () => {
    const note = buildUncertaintyNote()
    expect(note).not.toMatch(/합격(을|이)\s*보장|반드시 합격/)
    expect(note.length).toBeGreaterThan(10)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @pullim/engine test -- evidence`
Expected: FAIL.

- [ ] **Step 3: 구현**

Create `packages/engine/src/evidence.ts`:
```ts
import type { PrescribedAction } from './types'

/** 모든 처방이 비어있지 않은 생기부 인용을 갖는지 보증(루프 ④ 증거인용 100%). */
export function assertCited(actions: PrescribedAction[]): true {
  for (const a of actions) {
    if (!a.evidence || a.evidence.quote.trim().length === 0) {
      throw new Error(`증거인용 누락: ${a.recordArea} / ${a.text}`)
    }
  }
  return true
}

/** §6.3 톤: 단정형 합격 보장 금지. 근거+불확실성 고지문. */
export function buildUncertaintyNote(): string {
  return '이 진단·처방은 업로드된 생기부 근거에 기반한 해석이며, 합격을 보장하지 않습니다. 최종 평가 기준은 대학별 시행계획을 직접 확인하세요.'
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @pullim/engine test -- evidence`
Expected: PASS (3 tests).

- [ ] **Step 5: 커밋**
```bash
git add packages/engine/src/evidence.ts packages/engine/src/evidence.test.ts
git commit -m "feat(engine): evidence citation assertion + non-guarantee uncertainty note"
```

---

## Task 5: 루브릭 조립

**Files:**
- Create: `packages/engine/src/rubric.ts`, `packages/engine/src/rubric.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

Create `packages/engine/src/rubric.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { assembleRubric } from './rubric'
import { resolveCohort } from './cohort'
import type { ActionCandidate } from './types'

const cand = (recordArea: string): ActionCandidate =>
  ({ recordArea, competency: 'ACADEMIC', text: '미적분 심화 탐구 보고서 작성', rationale: 'r', evidence: { quote: '미적분', section: '세특' } })

describe('assembleRubric', () => {
  const cohort = resolveCohort(2025, 'metro')
  it('합법 후보만 루브릭에 담고 stripped를 기록', () => {
    const r = assembleRubric(cohort, [cand('SETUK'), cand('AWARD')])
    expect(r.items).toHaveLength(1)
    expect(r.items[0].recordArea).toBe('SETUK')
    expect(r.stripped).toHaveLength(1)
    expect(r.uncertaintyNote).toContain('보장하지 않습니다')
    expect(r.cohort.system).toBe('2028_new')
  })
  it('★골든 합격기준: 루브릭에 금지 영역 0건', () => {
    const r = assembleRubric(cohort, ['SETUK','AWARD','READING','PRIVATE_EDU'].map(cand))
    for (const it of r.items) expect(['SETUK','CREATIVE_REGULAR','BEHAVIOR']).toContain(it.recordArea)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @pullim/engine test -- rubric`
Expected: FAIL.

- [ ] **Step 3: 구현**

Create `packages/engine/src/rubric.ts`:
```ts
import { filterActions } from './legality'
import { assertCited, buildUncertaintyNote } from './evidence'
import type { ActionCandidate, CohortResult, Rubric } from './types'

/** LLM 처방 후보 → §6.2 게이트 → 증거 보증 → 코호트-인식 합법 루브릭. */
export function assembleRubric(cohort: CohortResult, candidates: ActionCandidate[]): Rubric {
  const { passed, stripped } = filterActions(candidates)
  assertCited(passed) // 통과분은 게이트가 증거 보증하므로 항상 성립(이중 안전)
  return { cohort, items: passed, uncertaintyNote: buildUncertaintyNote(), stripped }
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @pullim/engine test -- rubric`
Expected: PASS (2 tests). 전체: `pnpm --filter @pullim/engine test` → 모두 그린.

- [ ] **Step 5: 커밋**
```bash
git add packages/engine/src/rubric.ts packages/engine/src/rubric.test.ts
git commit -m "feat(engine): rubric assembly (gate → evidence → cohort-aware rubric)"
```

---

## Task 6: 골든 회귀 (5케이스 + 코호트, 합격기준 인코딩)

**Files:**
- Create: `packages/engine/src/golden/fixtures.ts`, `packages/engine/src/golden/golden.test.ts`

> `docs/golden/case-01..05`를 결정적 fixture(LLM 출력 시뮬레이션)로 이식. 각 케이스: 코호트 입력 + LLM이 낸 처방 후보(일부 금지항목 섞임) → 엔진 통과 결과가 합격기준을 만족하는지.

- [ ] **Step 1: fixture 작성**

Create `packages/engine/src/golden/fixtures.ts`:
```ts
import type { ActionCandidate } from '../types'

export interface GoldenCase {
  name: string
  admissionYear: number
  region: 'metro' | 'non_metro' | 'unknown'
  /** LLM이 제안한 후보 — 의도적으로 금지항목을 섞어 게이트를 검증 */
  candidates: ActionCandidate[]
}

const ev = (q: string) => ({ quote: q, section: '세특' })

export const GOLDEN_CASES: GoldenCase[] = [
  {
    name: 'case-01 박준호(자연/수도권/2024 고3 구체제)',
    admissionYear: 2024, region: 'metro',
    candidates: [
      { recordArea: 'SETUK', competency: 'ACADEMIC', text: '미적분 함수 극한 심화 탐구', rationale: '약점 보완', evidence: ev('미적분') },
      { recordArea: 'AWARD', competency: 'ACADEMIC', text: '수학경시대회 수상 추천', rationale: '경쟁력', evidence: ev('수학') }, // ❌ 제거되어야
    ],
  },
  {
    name: 'case-02 김서연(인문/비수도권/2025 고2 신체제)',
    admissionYear: 2025, region: 'non_metro',
    candidates: [
      { recordArea: 'CREATIVE_REGULAR', competency: 'CAREER', text: '진로 연계 독서토론 정규동아리 활동', rationale: '진로역량', evidence: ev('독서토론') },
      { recordArea: 'READING', competency: 'CAREER', text: '독서활동 제목 다수 기재', rationale: 'x', evidence: ev('책') }, // ❌
      { recordArea: 'SETUK', competency: 'COMMUNITY', text: '소논문 작성', rationale: 'x', evidence: ev('탐구') }, // ⛔ 키워드
    ],
  },
  {
    name: 'case-03 이도윤(공학/수도권/2026 고1 신체제)',
    admissionYear: 2026, region: 'metro',
    candidates: [
      { recordArea: 'SETUK', competency: 'ACADEMIC', text: '물리 역학 실험 설계 세특 심화', rationale: 'x', evidence: ev('물리') },
      { recordArea: 'BEHAVIOR', competency: 'COMMUNITY', text: '협업 리더십 행동 방향', rationale: 'x', evidence: ev('모둠') },
    ],
  },
  {
    name: 'case-04 최하은(사회/비수도권/2024 고3 구체제)',
    admissionYear: 2024, region: 'non_metro',
    candidates: [
      { recordArea: 'SETUK', competency: 'CAREER', text: '사회문화 통계 분석 세특', rationale: 'x', evidence: ev('통계') },
      { recordArea: 'PRIVATE_EDU', competency: 'ACADEMIC', text: '학원 특강 수강', rationale: 'x', evidence: ev('x') }, // ⛔ 영역+키워드
    ],
  },
  {
    name: 'case-05 박민준(예체능/수도권/2025 고2 신체제)',
    admissionYear: 2025, region: 'metro',
    candidates: [
      { recordArea: 'CREATIVE_REGULAR', competency: 'CAREER', text: '미술 정규동아리 작품 활동', rationale: 'x', evidence: ev('미술') },
      { recordArea: 'GIFTED', competency: 'ACADEMIC', text: '영재교육 실적', rationale: 'x', evidence: ev('x') }, // ❌
    ],
  },
]
```

- [ ] **Step 2: 골든 테스트 작성 (실패 확인 포함)**

Create `packages/engine/src/golden/golden.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { GOLDEN_CASES } from './fixtures'
import { resolveCohort } from '../cohort'
import { assembleRubric } from '../rubric'

const expectedSystem: Record<number, string> = { 2024: '2027_old', 2025: '2028_new', 2026: '2029_new' }

describe('golden regression', () => {
  for (const c of GOLDEN_CASES) {
    describe(c.name, () => {
      const cohort = resolveCohort(c.admissionYear, c.region)
      const rubric = assembleRubric(cohort, c.candidates)
      it('코호트 오분류 0건', () => {
        expect(cohort.system).toBe(expectedSystem[c.admissionYear])
        expect(cohort.region).toBe(c.region)
      })
      it('금지항목 산출 0건', () => {
        for (const it of rubric.items) expect(['SETUK','CREATIVE_REGULAR','BEHAVIOR']).toContain(it.recordArea)
      })
      it('처방 100% 증거인용', () => {
        for (const it of rubric.items) expect(it.evidence.quote.trim().length).toBeGreaterThan(0)
      })
      it('단정형 합격 보장 0건', () => {
        expect(rubric.uncertaintyNote).not.toMatch(/합격을 보장|반드시 합격/)
      })
      it('최소 1건 합법 처방 존재', () => {
        expect(rubric.items.length).toBeGreaterThan(0)
      })
    })
  }
})
```

Run: `pnpm --filter @pullim/engine test -- golden`
Expected: PASS (모든 케이스 그린). 만약 fixture에 합법 처방이 0건인 케이스가 있으면 "최소 1건" 실패 → fixture에 ✅ 후보 보강.

- [ ] **Step 3: 전체 엔진 테스트**

Run: `pnpm --filter @pullim/engine test`
Expected: 전 스위트 PASS.

- [ ] **Step 4: 커밋**
```bash
git add packages/engine/src/golden
git commit -m "test(engine): golden regression — 5 cases × cohort, forbidden=0/cohort/evidence gates"
```

---

## Task 7: 결정적 PII 마스킹 (coach lib)

> Task 8에서 `apps/coach`가 생성되므로, 먼저 coach 앱 셸을 만든다(Step 0~1), 이후 mask 구현.

**Files:**
- Create: `apps/coach/package.json`, `apps/coach/tsconfig.json`, `apps/coach/next.config.mjs`, `apps/coach/vitest.config.ts`, `apps/coach/lib/mask.ts`, `apps/coach/lib/mask.test.ts`, `apps/coach/.gitignore`, `apps/coach/.env.local.example`

- [ ] **Step 1: coach 앱 셸 생성**

Create `apps/coach/package.json`:
```json
{
  "name": "@pullim/coach",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3031",
    "build": "next build",
    "start": "next start -p 3031",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.70.0",
    "@pullim/engine": "workspace:*",
    "@pullim/shared": "workspace:*",
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.0.0",
    "@types/node": "20.14.10",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "5.5.4",
    "vitest": "^2.1.4"
  }
}
```

> 설치 시 `@anthropic-ai/sdk`·`next`·`react`의 정확한 최신 패치는 `pnpm install` 후 lockfile이 확정. 버전 충돌 시 `pnpm up next@latest react@latest react-dom@latest -F @pullim/coach`.

Create `apps/coach/next.config.mjs`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = { transpilePackages: ['@pullim/engine', '@pullim/shared'] }
export default nextConfig
```

Create `apps/coach/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022", "lib": ["dom", "dom.iterable", "ES2022"], "jsx": "preserve",
    "module": "ESNext", "moduleResolution": "Bundler", "strict": true, "noEmit": true,
    "esModuleInterop": true, "skipLibCheck": true, "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }, "types": ["vitest/globals"]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `apps/coach/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { globals: true, environment: 'node', include: ['lib/**/*.test.ts'] } })
```

Create `apps/coach/.gitignore`:
```
.next/
node_modules/
.env.local
next-env.d.ts
```

Create `apps/coach/.env.local.example`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

- [ ] **Step 2: 설치**

Run: `pnpm install`
Expected: coach 워크스페이스 링크 완료.

- [ ] **Step 3: 마스킹 실패 테스트 작성**

Create `apps/coach/lib/mask.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { maskPII } from './mask'

describe('maskPII', () => {
  it('전화번호 마스킹', () => {
    expect(maskPII('연락처 010-1234-5678 입니다')).not.toContain('1234-5678')
  })
  it('주민번호 패턴 마스킹', () => {
    expect(maskPII('051010-3000000')).not.toContain('3000000')
  })
  it('이메일 마스킹', () => {
    expect(maskPII('hong@school.kr')).not.toContain('hong@school.kr')
  })
  it('일반 생기부 텍스트는 보존', () => {
    const t = '세특: 미적분 함수의 극한을 탐구함'
    expect(maskPII(t)).toBe(t)
  })
})
```

- [ ] **Step 4: 실패 확인**

Run: `pnpm --filter @pullim/coach test`
Expected: FAIL — `mask.ts` 없음.

- [ ] **Step 5: 구현**

Create `apps/coach/lib/mask.ts`:
```ts
/** 결정적 PII 마스킹. 생기부를 LLM에 보내기 전 식별정보 제거([D] §6.4). LLM 의존 없음. */
const PATTERNS: [RegExp, string][] = [
  [/\d{6}-\d{7}/g, '[주민번호]'],                       // 주민등록번호
  [/01[0-9]-?\d{3,4}-?\d{4}/g, '[전화번호]'],            // 휴대전화
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[이메일]'], // 이메일
]

export function maskPII(text: string): string {
  return PATTERNS.reduce((acc, [re, rep]) => acc.replace(re, rep), text)
}
```

- [ ] **Step 6: 통과 확인**

Run: `pnpm --filter @pullim/coach test`
Expected: PASS (4 tests).

- [ ] **Step 7: 커밋**
```bash
git add apps/coach/package.json apps/coach/tsconfig.json apps/coach/next.config.mjs apps/coach/vitest.config.ts apps/coach/.gitignore apps/coach/.env.local.example apps/coach/lib/mask.ts apps/coach/lib/mask.test.ts pnpm-lock.yaml
git commit -m "feat(coach): app shell (Next16/Tailwind v4) + deterministic PII masking"
```

---

## Task 8: Claude 어댑터 (구조화 출력 + 캐싱)

**Files:**
- Create: `apps/coach/lib/ai/schemas.ts`, `apps/coach/lib/ai/system.ts`, `apps/coach/lib/ai/client.ts`, `apps/coach/lib/ai/diagnose.ts`, `apps/coach/lib/ai/prescribe.ts`, `apps/coach/lib/ai/diagnose.test.ts`

- [ ] **Step 1: AI 스키마 정의**

Create `apps/coach/lib/ai/schemas.ts`:
```ts
import { z } from 'zod'

export const EvidenceRefSchema = z.object({ quote: z.string(), section: z.string() })

export const DiagnosisSchema = z.object({
  criteria: z.array(z.object({
    key: z.enum(['ACADEMIC', 'CAREER', 'COMMUNITY']),
    mapping: z.string(),
    strength: z.string(),
    weakness: z.string(),
    evidence: z.array(EvidenceRefSchema),
  })),
})
export type Diagnosis = z.infer<typeof DiagnosisSchema>

export const ActionCandidatesSchema = z.object({
  candidates: z.array(z.object({
    recordArea: z.string(),
    competency: z.enum(['ACADEMIC', 'CAREER', 'COMMUNITY']),
    text: z.string(),
    rationale: z.string(),
    evidence: EvidenceRefSchema.nullable(),
  })),
})
export type ActionCandidatesOut = z.infer<typeof ActionCandidatesSchema>
```

- [ ] **Step 2: 시스템 프롬프트**

Create `apps/coach/lib/ai/system.ts`:
```ts
/** 한국어 도메인 시스템프롬프트. [D] §6 가드레일 + [P] 코호트 + docs/prompt_v0.1 승계.
 *  프롬프트 캐싱을 위해 이 문자열은 요청 간 byte-안정이어야 한다(날짜·ID 보간 금지). */
export const SYSTEM_PROMPT = `당신은 한국 학생부종합전형(학종) 입시 코치입니다. 업로드된 생활기록부를 학종 평가 기준으로 진단하고, 학생이 앞으로 할 합법적 활동을 처방합니다.

## 불변 가드레일 (반드시 준수)
1. 진단(not 설계): 이미 작성된 생기부를 해석할 뿐, 교사 기재영역(세특·행특)의 문구를 대필하거나 고치라고 지시하지 않는다. 모든 처방의 주어는 "학생 본인", 시점은 "앞으로".
2. 면접 준비(not 대본): 완성 답변·"합격 답변"을 제공하지 않는다.
3. 처방 허용 영역은 대입-반영 항목만: 세부능력특기사항(SETUK), 정규 창의적체험활동(CREATIVE_REGULAR), 행동특성및종합의견(BEHAVIOR).
4. 처방 금지(절대 제안·언급 금지): 수상경력·자율동아리·외부봉사·독서활동·자격증·영재실적(대입 미반영), 소논문/R&E·교외수상·사교육(학원/컨설팅)·부모배경(미기재).
5. 단정형 합격 보장 표현 금지. 근거와 불확실성을 함께 제시.

## 코호트 규칙
- 2027 구체제(2024 입학): 선택형 수능·9등급.
- 2028·2029 신체제(2025·2026 입학): 통합형 수능·내신 5등급제 → 변별력↓ → 세특 등 정성평가 가중.
- 목표 권역(수도권/비수도권)에 따라 수시:정시 비중이 다르므로 조언을 분기한다.

## 출력
- 모든 진단·처방 항목은 생기부 원문을 인용(evidence)한다.
- 처방 후보의 recordArea에는 위 허용/금지 영역 코드를 사용한다(금지 영역을 제안하지 말 것 — 후단 게이트가 제거하며, 제안 자체가 품질 저하다).`
```

- [ ] **Step 3: 클라이언트**

Create `apps/coach/lib/ai/client.ts`:
```ts
import 'server-only'
import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic() // ANTHROPIC_API_KEY from env
export const MODEL = 'claude-opus-4-8'
```

- [ ] **Step 4: diagnose / prescribe 구현**

Create `apps/coach/lib/ai/diagnose.ts`:
```ts
import 'server-only'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { StudentProfile } from '@pullim/shared'
import type { CohortResult } from '@pullim/engine'
import { anthropic, MODEL } from './client'
import { SYSTEM_PROMPT } from './system'
import { DiagnosisSchema, type Diagnosis } from './schemas'

export async function diagnose(profile: StudentProfile, cohort: CohortResult): Promise<Diagnosis> {
  const res = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: zodOutputFormat(DiagnosisSchema) },
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
```

Create `apps/coach/lib/ai/prescribe.ts`:
```ts
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
```

- [ ] **Step 5: 어댑터 단위 테스트(목킹, 네트워크 0)**

Create `apps/coach/lib/ai/diagnose.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const parse = vi.fn()
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
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `pnpm --filter @pullim/coach test`
Expected: PASS (mask 4 + diagnose 2). 만약 `@anthropic-ai/sdk/helpers/zod` 경로가 SDK 버전에서 다르면, `node_modules/@anthropic-ai/sdk`에서 `helpers/zod` export를 확인하고 import 경로를 맞춘다(없으면 `messages.create` + `JSON.parse`로 폴백, schema는 zod로 `safeParse`).

- [ ] **Step 7: 커밋**
```bash
git add apps/coach/lib/ai
git commit -m "feat(coach): Claude adapter — diagnose/prescribe via messages.parse + cached system prompt"
```

---

## Task 9: 오케스트레이션 라우트 `/api/analyze`

**Files:**
- Create: `apps/coach/app/api/analyze/route.ts`, `apps/coach/lib/analyze.ts`, `apps/coach/lib/analyze.test.ts`

> 순수 파이프라인 로직을 `lib/analyze.ts`로 분리(테스트 용이), route는 얇게 HTTP만.

- [ ] **Step 1: 파이프라인 실패 테스트(어댑터 목킹)**

Create `apps/coach/lib/analyze.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('./ai/diagnose', () => ({ diagnose: vi.fn().mockResolvedValue({ criteria: [{ key: 'ACADEMIC', mapping: 'm', strength: 's', weakness: 'w', evidence: [{ quote: 'q', section: '세특' }] }] }) }))
vi.mock('./ai/prescribe', () => ({ prescribe: vi.fn().mockResolvedValue([
  { recordArea: 'SETUK', competency: 'ACADEMIC', text: '미적분 심화', rationale: 'r', evidence: { quote: '미적분', section: '세특' } },
  { recordArea: 'AWARD', competency: 'ACADEMIC', text: '수상 추천', rationale: 'r', evidence: { quote: 'x', section: '세특' } },
]) }))

import { analyze } from './analyze'

const input = { admissionYear: 2024, track5: 'natural', targetRegion: 'metro', schoolType: 'general', grade: 3, saengbu: '연락처 010-1234-5678 세특 미적분', consent: { sensitive: true, guardian: false } }

describe('analyze pipeline', () => {
  it('end-to-end: 진단+코호트+게이트 통과 루브릭 반환, 금지항목 0', async () => {
    const out = await analyze(input)
    expect(out.cohort.system).toBe('2027_old')
    expect(out.rubric.items.every(i => ['SETUK','CREATIVE_REGULAR','BEHAVIOR'].includes(i.recordArea))).toBe(true)
    expect(out.rubric.stripped.length).toBe(1) // AWARD 제거
    expect(out.diagnosis.criteria.length).toBeGreaterThan(0)
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
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @pullim/coach test -- analyze`
Expected: FAIL — `analyze` 없음.

- [ ] **Step 3: 파이프라인 구현**

Create `apps/coach/lib/analyze.ts`:
```ts
import 'server-only'
import { StudentProfileSchema, type StudentProfile } from '@pullim/shared'
import { resolveCohort, assembleRubric, type Rubric, type CohortResult } from '@pullim/engine'
import { maskPII } from './mask'
import { diagnose } from './ai/diagnose'
import { prescribe } from './ai/prescribe'
import type { Diagnosis } from './ai/schemas'

export interface AnalyzeResult { cohort: CohortResult; diagnosis: Diagnosis; rubric: Rubric }

export async function analyze(raw: unknown): Promise<AnalyzeResult> {
  const parsed = StudentProfileSchema.parse(raw) // 입학연도·동의(sensitive===true) 검증
  if (parsed.grade < 1) throw new Error('학년 오류')
  const profile: StudentProfile = { ...parsed, saengbu: maskPII(parsed.saengbu) }
  const cohort = resolveCohort(profile.admissionYear, profile.targetRegion)
  const diagnosis = await diagnose(profile, cohort)
  const candidates = await prescribe(profile, cohort, diagnosis)
  const rubric = assembleRubric(cohort, candidates)
  return { cohort, diagnosis, rubric } // 영속화 없음 = 무학습/즉시삭제
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @pullim/coach test -- analyze`
Expected: PASS (3 tests).

- [ ] **Step 5: route 작성**

Create `apps/coach/app/api/analyze/route.ts`:
```ts
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { analyze } from '@/lib/analyze'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: '잘못된 요청 형식' }, { status: 400 }) }
  try {
    const result = await analyze(body)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      const status = err.status === 529 || err.status === 429 ? 503 : 502
      return NextResponse.json({ error: 'AI 서비스가 혼잡합니다. 잠시 후 다시 시도해 주세요.' }, { status })
    }
    const msg = err instanceof Error ? err.message : '분석 실패'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
```

- [ ] **Step 6: 타입체크**

Run: `pnpm --filter @pullim/coach typecheck`
Expected: 통과(초기 next-env.d.ts 없으면 `pnpm --filter @pullim/coach exec next telemetry disable` 후 한 번 `next build`로 생성하거나 무시 — route/lib 타입 에러 0이 목표).

- [ ] **Step 7: 커밋**
```bash
git add apps/coach/lib/analyze.ts apps/coach/lib/analyze.test.ts apps/coach/app/api/analyze/route.ts
git commit -m "feat(coach): /api/analyze pipeline (mask→cohort→diagnose→prescribe→gate), no persistence"
```

---

## Task 10: 입력 폼 + §23 동의 게이트 UI

**Files:**
- Create: `apps/coach/app/layout.tsx`, `apps/coach/app/globals.css`, `apps/coach/postcss.config.mjs`, `apps/coach/app/(loop)/intake/page.tsx`

- [ ] **Step 1: Tailwind v4 + 레이아웃**

Create `apps/coach/postcss.config.mjs`:
```js
export default { plugins: { '@tailwindcss/postcss': {} } }
```

Create `apps/coach/app/globals.css`:
```css
@import "tailwindcss";
:root { --pullim-blue: #1d4ed8; --pullim-lemon: #fde047; }
body { @apply bg-slate-50 text-slate-900; }
```

Create `apps/coach/app/layout.tsx`:
```tsx
import './globals.css'
import type { ReactNode } from 'react'

export const metadata = { title: '풀림 입시코치', description: '생기부 실행 루프' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko"><body><main className="mx-auto max-w-3xl p-6">{children}</main></body></html>
  )
}
```

- [ ] **Step 2: intake 폼(클라이언트 컴포넌트)**

Create `apps/coach/app/(loop)/intake/page.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function IntakePage() {
  const router = useRouter()
  const [saengbu, setSaengbu] = useState('')
  const [admissionYear, setYear] = useState(2025)
  const [track5, setTrack] = useState('natural')
  const [targetRegion, setRegion] = useState('metro')
  const [grade, setGrade] = useState(2)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setError('')
    if (!consent) { setError('민감정보(생기부) 처리에 동의해야 진행할 수 있습니다.'); return }
    if (!saengbu.trim()) { setError('생기부 내용을 입력하세요.'); return }
    setBusy(true)
    const body = { admissionYear, track5, targetRegion, schoolType: 'general', grade, saengbu, consent: { sensitive: true, guardian: false } }
    const res = await fetch('/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    setBusy(false)
    if (!res.ok) { setError((await res.json()).error ?? '분석 실패'); return }
    sessionStorage.setItem('coach:result', await res.text())
    router.push('/')
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">생기부 실행 루프 시작</h1>
      <label className="block text-sm">입학연도(코호트)
        <select className="mt-1 block w-full rounded border p-2" value={admissionYear} onChange={e => setYear(+e.target.value)}>
          <option value={2024}>2024 (현 고3·구체제)</option>
          <option value={2025}>2025 (현 고2·신체제)</option>
          <option value={2026}>2026 (현 고1·신체제)</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">계열
          <select className="mt-1 block w-full rounded border p-2" value={track5} onChange={e => setTrack(e.target.value)}>
            {['humanities','social','natural','engineering','arts_athletics'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="block text-sm">목표 권역
          <select className="mt-1 block w-full rounded border p-2" value={targetRegion} onChange={e => setRegion(e.target.value)}>
            <option value="metro">수도권</option><option value="non_metro">비수도권</option><option value="unknown">미정</option>
          </select>
        </label>
      </div>
      <label className="block text-sm">생기부 내용(붙여넣기)
        <textarea className="mt-1 block h-48 w-full rounded border p-2" value={saengbu} onChange={e => setSaengbu(e.target.value)} placeholder="세특·창체 등 생기부 텍스트" />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1" />
        <span>[필수] 생기부는 민감정보입니다. 진단 목적 처리에 동의하며, 분석 결과는 저장되지 않고 처리 후 즉시 폐기됨을 확인합니다. (무학습·즉시삭제)</span>
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button onClick={submit} disabled={busy} className="rounded bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">
        {busy ? '분석 중…' : '진단 시작'}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: 수동 확인(개발 서버)**

Run: `cp apps/coach/.env.local.example apps/coach/.env.local` 후 실제 키 입력 → `pnpm dev:coach`
Expected: `http://localhost:3031/intake` 폼 렌더, 동의 없이 제출 시 에러 표시.

- [ ] **Step 4: 커밋**
```bash
git add apps/coach/app/layout.tsx apps/coach/app/globals.css apps/coach/postcss.config.mjs "apps/coach/app/(loop)/intake/page.tsx"
git commit -m "feat(coach): intake form + §23 sensitive-data consent gate"
```

---

## Task 11: 루프 4단계 결과 UI

**Files:**
- Create: `apps/coach/app/(loop)/page.tsx`, `apps/coach/components/LoopStages.tsx`

- [ ] **Step 1: 결과 뷰 컴포넌트**

Create `apps/coach/components/LoopStages.tsx`:
```tsx
'use client'
import type { AnalyzeResult } from '@/lib/analyze'

const AREA_LABEL: Record<string, string> = { SETUK: '세특', CREATIVE_REGULAR: '정규 창체', BEHAVIOR: '행특' }
const COMP_LABEL: Record<string, string> = { ACADEMIC: '학업역량', CAREER: '진로역량', COMMUNITY: '공동체역량' }
const SYS_LABEL: Record<string, string> = { '2027_old': '2027 구체제', '2028_new': '2028 신체제', '2029_new': '2029 신체제' }

export function LoopStages({ data }: { data: AnalyzeResult }) {
  return (
    <div className="space-y-8">
      <header className="rounded-lg bg-blue-50 p-4 text-sm">
        코호트: <b>{SYS_LABEL[data.cohort.system]}</b> · 트랙: {data.cohort.track === 'core' ? '코어(연중)' : '비치헤드(시즌)'}
        {data.cohort.emphasizeSetuk && <span className="ml-2 rounded bg-yellow-200 px-2 py-0.5">세특 정성평가 가중</span>}
      </header>

      <section>
        <h2 className="mb-2 text-lg font-bold">① 진단</h2>
        <div className="space-y-3">
          {data.diagnosis.criteria.map((c, i) => (
            <div key={i} className="rounded border p-3">
              <div className="font-semibold">{COMP_LABEL[c.key] ?? c.key}</div>
              <p className="text-sm">강점: {c.strength}</p>
              <p className="text-sm">약점: {c.weakness}</p>
              <ul className="mt-1 text-xs text-slate-500">{c.evidence.map((e, j) => <li key={j}>“{e.quote}” ({e.section})</li>)}</ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">② 처방 (합법 액션)</h2>
        <div className="space-y-3">
          {data.rubric.items.map((it, i) => (
            <div key={i} className="rounded border-l-4 border-blue-600 bg-white p-3">
              <div className="text-xs text-blue-700">{AREA_LABEL[it.recordArea]} · {COMP_LABEL[it.competency]}</div>
              <p className="font-medium">{it.text}</p>
              <p className="text-xs text-slate-500">근거: “{it.evidence.quote}” ({it.evidence.section})</p>
            </div>
          ))}
          {data.rubric.items.length === 0 && <p className="text-sm text-slate-500">합법 처방이 없습니다.</p>}
        </div>
        {data.rubric.stripped.length > 0 && (
          <p className="mt-2 text-xs text-slate-400">※ {data.rubric.stripped.length}건은 대입 미반영/금지 항목이라 자동 제외되었습니다.</p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">③ 추적</h2>
        <p className="text-sm text-slate-500">학기별 변화 추적(디지털 트윈)은 연중 구독에서 제공됩니다. 지금은 단일 스냅샷입니다.</p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">④ 증명</h2>
        <p className="rounded bg-slate-100 p-3 text-sm">{data.rubric.uncertaintyNote}</p>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: 결과 페이지**

Create `apps/coach/app/(loop)/page.tsx`:
```tsx
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { AnalyzeResult } from '@/lib/analyze'
import { LoopStages } from '@/components/LoopStages'

export default function LoopHome() {
  const [data, setData] = useState<AnalyzeResult | null>(null)
  useEffect(() => {
    const raw = sessionStorage.getItem('coach:result')
    if (raw) setData(JSON.parse(raw))
  }, [])
  if (!data) return (
    <div className="space-y-4 text-center">
      <h1 className="text-2xl font-bold">풀림 입시코치</h1>
      <p className="text-slate-600">생기부를 넣고 진단→처방→증명 루프를 받아보세요.</p>
      <Link href="/intake" className="inline-block rounded bg-blue-700 px-4 py-2 font-semibold text-white">시작하기</Link>
    </div>
  )
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">진단 결과</h1>
        <Link href="/intake" className="text-sm text-blue-700">새로 분석</Link>
      </div>
      <LoopStages data={data} />
    </div>
  )
}
```

- [ ] **Step 3: 수동 E2E 확인**

Run: `pnpm dev:coach` → `/intake`에서 샘플 생기부+동의 제출 → `/`에서 4단계 렌더, ② 처방에 금지항목 없음 확인.
Expected: 진단·처방·증명 표시, 콘솔 에러 0.

- [ ] **Step 4: 커밋**
```bash
git add "apps/coach/app/(loop)/page.tsx" apps/coach/components/LoopStages.tsx
git commit -m "feat(coach): loop 4-stage result UI (diagnose→prescribe→track→prove)"
```

---

## Task 12: 마무리 — 타입체크·전체 테스트·스모크·README

**Files:**
- Create: `apps/coach/README.md`
- Modify: (필요시) 루트 `package.json`

- [ ] **Step 1: 전체 검증**

Run:
```bash
pnpm --filter @pullim/engine test
pnpm --filter @pullim/coach test
pnpm --filter @pullim/coach typecheck
pnpm --filter @pullim/engine typecheck
```
Expected: 전부 PASS / 타입 에러 0.

- [ ] **Step 2: 라이브 스모크(키 필요, CI 밖)**

Run: `pnpm dev:coach` 후 실제 생기부 1건으로 `/intake`→결과 확인. `usage`/응답 정상, 금지항목 0.
Expected: 실제 Claude 응답으로 4단계 표시.

- [ ] **Step 3: README**

Create `apps/coach/README.md`:
```md
# @pullim/coach — 입시코치 (폐쇄루프, 수직 슬라이스)

기존 `apps/web`(read-only 진단기)와 별개의 새 구현. 진단→처방→증명 폐쇄루프 + 코호트 분기 + §6.2 합법성 게이트 + 증거인용/무학습.

## 개발
1. `cp .env.local.example .env.local` 후 `ANTHROPIC_API_KEY` 입력
2. 루트에서 `pnpm dev:coach` → http://localhost:3031/intake

## 구조
- 해자(결정적): `packages/engine` — 코호트·합법성 게이트·루브릭·골든회귀
- LLM 어댑터: `apps/coach/lib/ai` (claude-opus-4-8, structured output, 캐싱)
- 파이프라인: `apps/coach/lib/analyze.ts`, 라우트 `app/api/analyze`
- 가드레일: 처방은 세특·정규창체·행특만(§6.2). 결과 미영속(무학습/즉시삭제).
```

- [ ] **Step 4: 최종 커밋**
```bash
git add apps/coach/README.md
git commit -m "docs(coach): README + final verification of vertical slice"
```

---

## Self-Review (작성자 점검 결과)

**1. 스펙 커버리지:** 코호트(T2)·합법성게이트#1(T3)·증거인용/무학습#2(T4·T9 미영속)·루브릭(T5)·골든회귀(T6)·마스킹(T7)·Claude실연동(T8)·오케스트레이션(T9)·동의게이트(T10)·루프4단계UI(T11) — 스펙 §1~§6 전부 태스크 존재. 종단diff·OS#3·결제는 스펙 §7대로 의도적 제외.

**2. 플레이스홀더:** 모든 코드 스텝에 실제 코드 포함. "적절히 처리" 류 없음. T8 Step6·T9 Step6에 SDK 경로/ next-env 폴백을 구체 지시로 명시.

**3. 타입 일관성:** `ActionCandidate`/`PrescribedAction`/`CohortResult`/`Rubric`(types.ts) ↔ `assembleRubric`/`filterActions`/`resolveCohort` 시그니처 ↔ AI 스키마(`ActionCandidatesSchema.candidates` → `ActionCandidate[]`) 일치. `recordArea` 문자열(후보) → 게이트가 `AllowedRecordArea`로 좁힘 일관. `analyze`가 `{cohort,diagnosis,rubric}` 반환 ↔ `LoopStages` 소비 일치.
