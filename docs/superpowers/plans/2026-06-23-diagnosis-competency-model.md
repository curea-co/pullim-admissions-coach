# 학종 진단 3역량 전환 Implementation Plan (#19)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 생기부 진단을 낡은 5축(학업·진로·공동체·인성·기타)·등급 뱃지에서 현행 학종 표준인 3역량(학업·진로·공동체) + 10 평가항목 + 항목별 강점/보완 + 근거(evidence) 구조로 전환한다.

**Architecture:** 진단 출력 Zod 스키마를 `packages/shared`로 승격(입력 스키마와 동일 위치). `apps/web` mock·result UI가 이를 컴파일타임(`satisfies`)으로 소비. SSOT 문서(정의 §4-2·prompt·golden 5건)를 같은 모델로 cascade. 테스트 러너(vitest)가 없으므로 첫 태스크에서 도입하고, 스키마는 합성 fixture로 단위 검증한다.

**Tech Stack:** TypeScript 5.5.4, Zod ^3.23.8, Vitest ^2.1, pnpm 9.7.0 workspace, Next.js 14(App Router), Tailwind.

## Global Constraints

> 모든 태스크의 요구사항에 암묵적으로 포함된다. 값은 spec에서 그대로 옮김.

- **§6 가드레일:** 생기부 "진단"만(개입/대필 금지 §6.1) · 면접 "준비"만(대본 금지 §6.2) · 미성년 데이터 보호(§6.3). 모든 보완/다음 단계 문장의 주어=**학생 본인**, 시점=**앞으로**.
- **명칭 고정:** "생기부 진단 가이드"(❌"설계"). "학종 면접 준비 팩"(❌"면접 답변"/"합격 답변"). 본 작업은 진단 한정.
- **진단 출력 규칙:** 정확히 **3역량** `academic`·`career`·`community` 각 1건. **`인성`/`기타` 단독 축 금지.** **`강함|보통|약함` 등급 라벨 금지.** 각 highlight의 `item`은 해당 역량의 공식 평가항목 집합에 속해야 함.
- **근거(evidence):** 각 highlight ≥ 1건. 각 evidence 문자열은 섹션 prefix(`세특`·`창체`·`진로활동`·`독서활동`·`행특`·`교과`·`자율활동`·`봉사활동`·`동아리`·`수행평가`)로 시작.
- **schema_version:** 진단 **출력** 스키마 `0.2`(prompt/golden/상수). 입력 `SCHEMA_VERSION`(student_profile)은 **`0.1` 불변**.
- **공식 3역량·10항목 (변경 금지):**
  - 학업역량: 학업성취도 · 학업태도 · 탐구력
  - 진로역량: 전공(계열) 관련 교과 이수 노력 · 전공(계열) 관련 교과 성취도 · 진로 탐색 활동과 경험
  - 공동체역량: 협업과 소통능력 · 나눔과 배려 · 성실성과 규칙준수 · 리더십
- **런타임:** node >= 20.11, pnpm 9.7.0.
- **EPO 검수 게이트:** Task 4·5(정의·prompt·golden 변경)는 EPO(최선혜) 승인 전 머지 금지.

## File Structure

| 파일 | 책임 | 태스크 |
|---|---|---|
| `packages/shared/vitest.config.ts` (생성) | 테스트 러너 설정 | 1 |
| `packages/shared/package.json` (수정) | vitest devDep + `test` 스크립트 | 1 |
| `package.json` (수정, 루트) | `test` 스크립트 배선 | 1 |
| `justfile` (수정) | `just test` 타깃 | 1 |
| `packages/shared/src/diagnosis.ts` (생성) | 진단 출력 스키마·상수·타입 | 2 |
| `packages/shared/src/diagnosis.test.ts` (생성) | 스키마 단위테스트(합성 fixture) | 2 |
| `packages/shared/src/index.ts` (수정) | diagnosis 배럴 export | 2 |
| `apps/web/lib/mock/park-junho.ts` (수정) | 진단 mock을 3역량 구조로 + `satisfies` | 3 |
| `apps/web/app/result/page.tsx` (수정) | DiagnosisPanel 재작성, 등급 뱃지 제거 | 3 |
| `docs/002_Admissions_Coach_definition_v.3.md` (수정) | §4-2 + §11 cascade·변경이력 | 4 |
| `docs/prompt_v0.1.md` (수정) | §2 JSON·§5 표·체크리스트·§4.6 NG·§12 | 4 |
| `docs/golden/case-01~05-*.md` (수정) | 기대 출력 ② 재작성 + NG 셋 | 5 |
| `docs/golden/README.md` (수정) | 출력 ② 구조 설명 | 5 |

---

### Task 1: 테스트 러너(vitest) 도입 + 배선

**Files:**
- Create: `packages/shared/vitest.config.ts`
- Modify: `packages/shared/package.json`, `package.json`, `justfile`
- Test: `packages/shared/src/consent.smoke.test.ts` (생성 — 러너 증명용 실제 테스트)

**Interfaces:**
- Consumes: 기존 `consentSchema` (`packages/shared/src/schemas.ts`).
- Produces: `pnpm --filter @pullim/shared test`, `just test` 가 동작.

- [ ] **Step 1: vitest 설치 (devDependency)**

Run:
```bash
pnpm --filter @pullim/shared add -D vitest@^2.1.0
```
Expected: `packages/shared/package.json` devDependencies에 `vitest` 추가, lockfile 갱신.

- [ ] **Step 2: vitest 설정 파일 생성**

Create `packages/shared/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: `test` 스크립트 추가 (shared)**

`packages/shared/package.json`의 `"scripts"`를 다음으로 수정:
```json
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
```

- [ ] **Step 4: 루트·justfile 배선**

루트 `package.json`의 `"scripts"`에 추가:
```json
    "test": "pnpm --filter @pullim/shared test",
```
`justfile`에 타깃 추가(파일 끝에):
```make
test:
    pnpm test
```
그리고 `justfile`의 `check:` 타깃을 다음으로 수정해 테스트를 게이트에 포함:
```make
check:
    pnpm lint
    pnpm typecheck
    pnpm test
```

- [ ] **Step 5: 러너 증명용 실제 테스트 작성 (실패 먼저)**

Create `packages/shared/src/consent.smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { consentSchema } from './schemas';

describe('consentSchema (러너 동작 확인)', () => {
  it('미성년자는 법정대리인 동의 없으면 실패한다', () => {
    const r = consentSchema.safeParse({
      isMinor: true,
      termsAgreed: true,
      privacyPolicyAgreed: true,
      guardianConsentObtained: false,
      consentTimestamp: '2026-06-23T00:00:00.000Z',
    });
    expect(r.success).toBe(false);
  });

  it('필수 동의가 모두 true면 통과한다', () => {
    const r = consentSchema.safeParse({
      isMinor: false,
      termsAgreed: true,
      privacyPolicyAgreed: true,
      guardianConsentObtained: false,
      consentTimestamp: '2026-06-23T00:00:00.000Z',
    });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 6: 테스트 실행 → 통과 확인**

Run: `pnpm --filter @pullim/shared test`
Expected: 2 passed. (러너가 정상 동작함을 증명.)

- [ ] **Step 7: 커밋**

```bash
git add packages/shared/vitest.config.ts packages/shared/package.json packages/shared/src/consent.smoke.test.ts package.json justfile pnpm-lock.yaml
git commit -m "test: vitest 러너 도입 + just test 배선 (#19)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 진단 출력 스키마 (packages/shared)

**Files:**
- Create: `packages/shared/src/diagnosis.ts`, `packages/shared/src/diagnosis.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: `zod`.
- Produces (Task 3·4·5가 의존하는 정확한 이름·타입):
  - `DIAGNOSIS_SCHEMA_VERSION: '0.2'`
  - `competencyEnum`, `type Competency = 'academic'|'career'|'community'`
  - `competencyLabel: Record<Competency,string>`
  - `COMPETENCY_ITEMS: Record<Competency, readonly string[]>`
  - `itemFlagEnum`, `type ItemFlag = 'strength'|'gap'`
  - `SECTION_PREFIX_RE: RegExp`
  - `diagnosisGuideSchema`, `type DiagnosisGuide`, `type DiagnosisCompetency`, `type DiagnosisHighlight`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `packages/shared/src/diagnosis.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { diagnosisGuideSchema } from './diagnosis';

// 정상 3역량 합성 fixture (park-junho 데모와 별개의 최소 유효값)
const valid = {
  criteria: [
    {
      competency: 'academic',
      summary: '교과 성취와 탐구 기록이 탄탄합니다.',
      highlights: [
        { item: '탐구력', flag: 'strength', evidence: ['세특-정보(자료구조 발표)'], note: '발표로 학습을 확장함.' },
      ],
      nextSteps: '심화 학습을 진로 활동으로 본인이 연결해볼 것.',
    },
    {
      competency: 'career',
      summary: '진로 방향은 분명하나 직접 시도 기록이 더 필요합니다.',
      highlights: [
        { item: '진로 탐색 활동과 경험', flag: 'gap', evidence: ['진로활동-진로탐색 보고서'], note: '본인 주도 프로젝트 기록이 적음.' },
      ],
      nextSteps: '동아리 산출물을 본인이 정리해 시도를 드러낼 것.',
    },
    {
      competency: 'community',
      summary: '협력 경험은 있으나 역할 정리가 더 필요합니다.',
      highlights: [
        { item: '성실성과 규칙준수', flag: 'strength', evidence: ['행특(성실·책임 일관)'], note: '교사 평가가 일관됨.' },
      ],
      nextSteps: '팀 작업에서 본인 역할을 한두 줄로 정리할 것.',
    },
  ],
};

describe('diagnosisGuideSchema', () => {
  it('정상 3역량 구조는 통과한다', () => {
    expect(diagnosisGuideSchema.safeParse(valid).success).toBe(true);
  });

  it('criteria가 3건이 아니면 실패한다', () => {
    const bad = { criteria: valid.criteria.slice(0, 2) };
    expect(diagnosisGuideSchema.safeParse(bad).success).toBe(false);
  });

  it('역량이 중복되면(공동체 누락) 실패한다', () => {
    const bad = { criteria: [valid.criteria[0], valid.criteria[1], { ...valid.criteria[0] }] };
    expect(diagnosisGuideSchema.safeParse(bad).success).toBe(false);
  });

  it('항목이 해당 역량의 평가항목이 아니면 실패한다', () => {
    const bad = structuredClone(valid);
    bad.criteria[0].highlights[0].item = '리더십'; // academic에 community 항목
    expect(diagnosisGuideSchema.safeParse(bad).success).toBe(false);
  });

  it('근거에 섹션 prefix가 없으면 실패한다', () => {
    const bad = structuredClone(valid);
    bad.criteria[0].highlights[0].evidence = ['자료구조 발표']; // prefix 없음
    expect(diagnosisGuideSchema.safeParse(bad).success).toBe(false);
  });

  it('근거가 비어 있으면 실패한다', () => {
    const bad = structuredClone(valid);
    bad.criteria[0].highlights[0].evidence = [];
    expect(diagnosisGuideSchema.safeParse(bad).success).toBe(false);
  });

  it('summary에 등급 라벨(보통)이 있으면 실패한다', () => {
    const bad = structuredClone(valid);
    bad.criteria[0].summary = '학업역량 보통';
    expect(diagnosisGuideSchema.safeParse(bad).success).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @pullim/shared test`
Expected: FAIL — `Cannot find module './diagnosis'`.

- [ ] **Step 3: 스키마 구현**

Create `packages/shared/src/diagnosis.ts`:
```ts
// Pullim Admissions Coach — 진단 출력(생기부 진단 가이드) 스키마
// SSOT: docs/002_..._definition_v.3.md §4-2, docs/prompt_v0.1.md §2/§5
// 현행 학종 3역량(학업·진로·공동체) + 10 평가항목. '인성'·'기타' 축, 등급 라벨 금지.

import { z } from 'zod';

export const DIAGNOSIS_SCHEMA_VERSION = '0.2' as const;

export const competencyEnum = z.enum(['academic', 'career', 'community']);
export type Competency = z.infer<typeof competencyEnum>;

export const competencyLabel: Record<Competency, string> = {
  academic: '학업역량',
  career: '진로역량',
  community: '공동체역량',
};

// 공식 10 평가항목 (5개 대학 공통 평가요소). 변경 금지.
export const COMPETENCY_ITEMS: Record<Competency, readonly string[]> = {
  academic: ['학업성취도', '학업태도', '탐구력'],
  career: [
    '전공(계열) 관련 교과 이수 노력',
    '전공(계열) 관련 교과 성취도',
    '진로 탐색 활동과 경험',
  ],
  community: ['협업과 소통능력', '나눔과 배려', '성실성과 규칙준수', '리더십'],
};

export const itemFlagEnum = z.enum(['strength', 'gap']); // ◎강점 / △보완
export type ItemFlag = z.infer<typeof itemFlagEnum>;

// 근거(evidence) 섹션 prefix — prompt §6.2 근거 가시화 규칙과 동일 소스.
export const SECTION_PREFIX_RE =
  /^(세특|창체|진로활동|독서활동|행특|교과|자율활동|봉사활동|동아리|수행평가)/;

// §6 가드: 등급 라벨 출력 금지(축이 제거됐어도 산문에 새어나오지 않게 방어).
const FORBIDDEN_GRADE_RE = /(강함|보통|약함)/;

const highlightSchema = z.object({
  item: z.string().min(1),
  flag: itemFlagEnum,
  evidence: z
    .array(
      z
        .string()
        .min(1)
        .regex(SECTION_PREFIX_RE, '근거는 섹션 prefix(예: 세특-정보)로 시작해야 합니다')
    )
    .min(1, '근거(evidence)를 1건 이상 제시해주세요'),
  note: z.string().min(1),
});

export const diagnosisCompetencySchema = z
  .object({
    competency: competencyEnum,
    summary: z
      .string()
      .min(1)
      .refine((s) => !FORBIDDEN_GRADE_RE.test(s), '등급 표현(강함/보통/약함)은 사용하지 않습니다'),
    highlights: z
      .array(highlightSchema)
      .min(1, '역량별 강점·보완 하이라이트를 1건 이상 제시해주세요'),
    nextSteps: z.string().min(1),
  })
  .refine(
    (c) => c.highlights.every((h) => COMPETENCY_ITEMS[c.competency].includes(h.item)),
    { message: '하이라이트 항목은 해당 역량의 평가항목이어야 합니다', path: ['highlights'] }
  );

export const diagnosisGuideSchema = z
  .object({
    schemaVersion: z.literal(DIAGNOSIS_SCHEMA_VERSION).optional(),
    criteria: z
      .array(diagnosisCompetencySchema)
      .length(3, '진단은 3역량 정확히 3건이어야 합니다'),
  })
  .refine((g) => new Set(g.criteria.map((c) => c.competency)).size === 3, {
    message: 'academic·career·community 3역량이 각각 1건씩 있어야 합니다',
    path: ['criteria'],
  });

export type DiagnosisHighlight = z.infer<typeof highlightSchema>;
export type DiagnosisCompetency = z.infer<typeof diagnosisCompetencySchema>;
export type DiagnosisGuide = z.infer<typeof diagnosisGuideSchema>;
```

- [ ] **Step 4: 배럴 export**

`packages/shared/src/index.ts`를 다음으로 수정:
```ts
// Pullim Admissions Coach — shared barrel.
// Phase B: Zod schemas synced with docs/student_profile_schema_v0.1.json.
// Phase D: AI output DTOs synced with definition v0.3 §4.

export * from './schemas';
export * from './diagnosis';
```

- [ ] **Step 5: 테스트 통과 + 타입 확인**

Run: `pnpm --filter @pullim/shared test && pnpm --filter @pullim/shared typecheck`
Expected: 7 passed(+이전 smoke 2), typecheck 무에러.

- [ ] **Step 6: 커밋**

```bash
git add packages/shared/src/diagnosis.ts packages/shared/src/diagnosis.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): 진단 3역량 출력 스키마 + 단위테스트 (#19)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: mock + DiagnosisPanel 전환 (apps/web)

**Files:**
- Modify: `apps/web/lib/mock/park-junho.ts`, `apps/web/app/result/page.tsx`

**Interfaces:**
- Consumes: Task 2의 `DiagnosisGuide`, `competencyLabel`, `type DiagnosisCompetency`.
- Produces: `parkJunho.diagnosisGuide: DiagnosisGuide` (컴파일타임 `satisfies`로 conformance 보장).

- [ ] **Step 1: mock 타입 import 교체 + 진단부 재작성**

`apps/web/lib/mock/park-junho.ts`에서:

1) 상단 import 수정:
```ts
import type { TargetTrack, SchoolType, DiagnosisGuide } from '@pullim/shared';
```

2) 로컬 `DiagnosisCriterion` 타입 정의(파일 14~19줄 부근) **삭제**.

3) `diagnosisGuide` 블록을 다음으로 교체:
```ts
  diagnosisGuide: {
    criteria: [
      {
        competency: 'academic',
        summary: '교과 성취와 탐구 기록이 탄탄합니다.',
        highlights: [
          {
            item: '학업성취도',
            flag: 'strength',
            evidence: ['세특-정보(자료구조 발표)', '세특-수학(미적분 응용)'],
            note: '정보·수학 성취도가 우수하고 세특 기록이 구체적입니다.',
          },
          {
            item: '탐구력',
            flag: 'strength',
            evidence: ['세특-정보(자료구조·알고리즘 학습)'],
            note: '학습 결과를 발표로 확장한 시도가 보입니다.',
          },
          {
            item: '학업태도',
            flag: 'gap',
            evidence: ['교과-정보'],
            note: '자기주도 학습 과정의 기록이 더 드러나면 인상이 또렷해집니다.',
          },
        ],
        nextSteps: '심화 학습 경험을 진로 활동·정리로 본인이 연결해 일관성을 만들 것.',
      },
      {
        competency: 'career',
        summary: '진로 방향은 분명하나 본인이 직접 시도한 사례 기록이 더 필요합니다.',
        highlights: [
          {
            item: '전공(계열) 관련 교과 이수 노력',
            flag: 'strength',
            evidence: ['교과-정보', '교과-수학'],
            note: '전공 관련 교과를 충실히 이수했습니다.',
          },
          {
            item: '진로 탐색 활동과 경험',
            flag: 'gap',
            evidence: ['진로활동-진로탐색 보고서(소프트웨어 엔지니어)'],
            note: '본인 주도 프로젝트·산출물 기록이 다소 적습니다.',
          },
        ],
        nextSteps: '동아리에서 만든 산출물·코드를 본인이 진로활동·자율 정리란에 정리해 시도와 학습을 보여줄 것.',
      },
      {
        competency: 'community',
        summary: '협력 경험과 성실성은 안정적이나 본인 역할 정리가 더 필요합니다.',
        highlights: [
          {
            item: '성실성과 규칙준수',
            flag: 'strength',
            evidence: ['행특(성실·책임감 평가 일관)'],
            note: '담임·교과 교사 평가가 일관됩니다.',
          },
          {
            item: '협업과 소통능력',
            flag: 'gap',
            evidence: ['수행평가 팀 과제', '창체-동아리(발표 준비)'],
            note: '역할·갈등 해결 과정에 대한 본인 정리가 부족합니다.',
          },
        ],
        nextSteps: '팀 작업에서 본인이 맡은 역할과 어떤 결정에 어떻게 기여했는지를 한두 줄로 본인이 직접 정리할 것.',
      },
    ],
  } satisfies DiagnosisGuide,
```

> 비고: 기존 '인성' 항목은 community의 `성실성과 규칙준수`로 흡수, '기타(독서)' 축은 제거(#20 별개). `as const` 객체 안에서 `diagnosisGuide`만 `satisfies DiagnosisGuide`를 받는다.

- [ ] **Step 2: 타입 검증 (의도적으로 먼저 실행 — UI 전이라 result가 깨짐)**

Run: `pnpm --filter @pullim/web typecheck`
Expected: FAIL — `result/page.tsx`의 DiagnosisPanel이 옛 필드(`c.name`,`c.score`,`c.observation`)를 참조해 타입 에러. (다음 스텝에서 수정.)

- [ ] **Step 3: DiagnosisPanel 재작성**

`apps/web/app/result/page.tsx`:

1) 상단 import에 추가:
```ts
import { competencyLabel } from '@pullim/shared';
```

2) `DiagnosisPanel` 함수 전체를 다음으로 교체:
```tsx
function DiagnosisPanel() {
  const flagStyle = {
    strength: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    gap: 'border-amber-200 bg-amber-50 text-amber-700',
  } as const;
  const flagLabel = { strength: '◎ 강점', gap: '△ 보완' } as const;

  return (
    <section className="space-y-4">
      {parkJunho.diagnosisGuide.criteria.map((c) => (
        <article
          key={c.competency}
          className="rounded-2xl border border-ink-100 bg-white p-5"
        >
          <h3 className="text-base font-semibold text-ink-900">
            {competencyLabel[c.competency]}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-700">{c.summary}</p>

          <ul className="mt-4 space-y-3">
            {c.highlights.map((h, idx) => (
              <li key={idx} className="rounded-xl border border-ink-100 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-xs font-semibold',
                      flagStyle[h.flag]
                    )}
                  >
                    {flagLabel[h.flag]}
                  </span>
                  <span className="text-sm font-semibold text-ink-900">
                    {h.item}
                  </span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-700">
                  {h.note}
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {h.evidence.map((e) => (
                    <li
                      key={e}
                      className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700"
                    >
                      {e}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          <div className="mt-4 border-t border-ink-100 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              앞으로 할 활동 / 정리 방향
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ink-900">
              {c.nextSteps}
            </p>
          </div>
        </article>
      ))}
    </section>
  );
}
```

> `cn`은 이미 이 파일에서 import됨(`@/lib/utils`). 옛 `scoreStyle` 객체와 `c.name/c.score/c.observation` 참조는 위 교체로 완전히 사라진다.

- [ ] **Step 4: 타입체크 + 빌드 통과 확인**

Run: `pnpm --filter @pullim/web typecheck && pnpm --filter @pullim/web build`
Expected: typecheck 무에러, `next build` 성공. (`satisfies DiagnosisGuide`가 mock 구조 적합성을 컴파일타임에 보장.)

- [ ] **Step 5: 시각 확인 (수동)**

Run: `pnpm --filter @pullim/web dev` 후 `http://localhost:3030/result` 진단 탭 확인.
Expected: 3개 역량 카드(학업/진로/공동체), 각 카드에 ◎강점/△보완 하이라이트·근거 칩·"앞으로 할 활동". 강함/보통/약함 뱃지 없음.

- [ ] **Step 6: 커밋**

```bash
git add apps/web/lib/mock/park-junho.ts apps/web/app/result/page.tsx
git commit -m "feat(web): 진단 결과를 3역량 카드(강점/보완·근거)로 전환 (#19, #21)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: SSOT 문서 — 정의 §4-2 + prompt (EPO 검수 게이트)

**Files:**
- Modify: `docs/002_Admissions_Coach_definition_v.3.md`, `docs/prompt_v0.1.md`

**Interfaces:**
- Consumes: Global Constraints의 3역량·10항목·NG 규칙.
- Produces: Task 5(golden)가 참조하는 출력 ② 구조의 SSOT.

- [ ] **Step 1: 정의 §4-2 교체**

`docs/002_Admissions_Coach_definition_v.3.md` §4-2 행(현 51번 줄)의 진단 가이드 셀을 다음으로 교체:
```
| 2 | **생기부 진단 가이드** | 학종 3역량(학업역량·진로역량·공동체역량) + 10 평가항목 매핑 + 역량별 강점·보완 항목 하이라이트(근거 생기부 항목 포함) + **학생 본인이 앞으로 할 수 있는** 보완 활동·정리 방향 | 접수 후 24h 내 1차본 |
```

- [ ] **Step 2: 정의 변경이력·cascade 메모 추가**

같은 문서 변경이력 표 맨 아래에 행 추가:
```
| v0.3.2 | 2026-06-23 (화) | 진단 평가요소를 5축(…인성·기타)에서 현행 학종 3역량(학업·진로·공동체)+10 평가항목으로 전환. 등급(강함/보통/약함) 폐지 → 항목별 강점/보완. 출력 schema_version 0.2. prompt §2/§5/§4 + golden 5건 cascade. (#19) |
```

- [ ] **Step 3: prompt §2 출력 JSON 스키마 — diagnosis 블록 교체**

`docs/prompt_v0.1.md` §2 시스템 프롬프트의 `"diagnosis_guide"` 블록을 다음으로 교체:
```
  "diagnosis_guide": {
    "criteria": [
      {
        "competency": "academic" | "career" | "community",
        "summary": "<역량 정성 요약 한 문장 — 등급(강함/보통/약함) 금지>",
        "highlights": [
          {
            "item": "<해당 역량의 공식 평가항목 중 하나>",
            "flag": "strength" | "gap",
            "evidence": ["<섹션 prefix + 생기부 항목>", ...],
            "note": "<관찰 한두 문장>"
          }
          // 역량별 1건 이상
        ],
        "next_steps": "<학생 본인이 앞으로 할 활동 한두 문장>"
      }
      // 정확히 3건: academic, career, community 각 1건
    ]
  },
```

- [ ] **Step 4: prompt §5 매핑표 교체**

§5 "학종 평가 기준 5항목 매핑" 섹션 제목을 "학종 3역량·10 평가항목 매핑"으로 바꾸고 표를 다음으로 교체:
```
| 역량 | 평가항목 | 무엇을 보는가 |
|---|---|---|
| 학업역량 | 학업성취도 · 학업태도 · 탐구력 | 교과 성취, 자기주도 학습 의지, 지적 호기심·탐구 시도 |
| 진로역량 | 전공(계열) 관련 교과 이수 노력 · 전공(계열) 관련 교과 성취도 · 진로 탐색 활동과 경험 | 진로 일관성, 전공 관련 교과 이수·성취, 본인 주도 탐색 |
| 공동체역량 | 협업과 소통능력 · 나눔과 배려 · 성실성과 규칙준수 · 리더십 | 협력·중재, 역할의 구체성, 성실·책임(구 '인성' 흡수) |

- 출력은 역량 단위 3건. 각 역량에서 두드러진 항목만 `strength`/`gap`으로 하이라이트(전 10항목 나열 불필요).
- '인성'·'기타'를 **별도 항목/축으로 출력하지 않는다**(인성은 공동체역량에 포함).
- 등급(강함/보통/약함)을 출력하지 않는다 — 정성 요약 + 강점/보완 플래그만.
```

- [ ] **Step 5: prompt 자기검토 체크리스트 갱신**

§2 끝 "절대 규칙 재확인" 체크리스트에서 진단 관련 항목(7번)을 다음으로 교체/보강:
```
7. 진단 = 정확히 3역량(academic·career·community) 각 1건. 각 역량 highlights 1건 이상, 각 highlight의 evidence 1건 이상 + 섹션 prefix 포함.
8. 진단 출력에 '인성'·'기타' 항목, '강함/보통/약함' 등급 라벨 0건.
```
(체크리스트 총 개수 표기가 있으면 7→8개로 동기화.)

- [ ] **Step 6: prompt §4.6 NG 정규식 추가**

§4에 하위 절 추가:
```
### 4.6 §4(진단 평가요소) NG 정규식 — 3역량 전환(#19)

\`\`\`regex
"(name|competency)"\s*:\s*"(인성|기타)"
"(score|grade|등급)"\s*:\s*"?(강함|보통|약함)
(강함|보통|약함)\s*(점|등급|수준)
\`\`\`

진단 출력에 위 패턴이 매치되면 회귀 실패(응답 폐기·재생성).
```

- [ ] **Step 7: prompt §12 변경이력 추가**

§12 표 맨 아래 행 추가:
```
| v0.3 | 2026-06-23 (화) | 진단을 3역량(학업·진로·공동체)+10항목으로 전환. diagnosis_guide JSON 구조 변경(criteria 3건·highlights[]·flag·evidence·next_steps), §5 매핑표 재작성, 인성/기타·등급 NG(§4.6), 자기검토 7→8개. 출력 schema_version 0.2. **회귀 5건 재실행 필요**(#19) |
```

- [ ] **Step 8: 게이트 검증**

Run: `just check`
Expected: lint·typecheck·test 통과(문서 변경은 코드 무영향).
**EPO 검수 게이트:** 이 커밋은 EPO(최선혜) 승인 전 main 머지 금지. 커밋 메시지에 검수 요청 명시.

- [ ] **Step 9: 커밋**

```bash
git add docs/002_Admissions_Coach_definition_v.3.md docs/prompt_v0.1.md
git commit -m "docs(ssot): 진단 평가요소 3역량 전환 — 정의 §4-2 + prompt §2/§5/§4 (#19)

EPO(최선혜) 검수 필요: 정의·프롬프트 SSOT 변경.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: 골든 5케이스 + README (EPO 검수 게이트)

**Files:**
- Modify: `docs/golden/case-01-park-junho.md` … `case-05-park-minjun.md`, `docs/golden/README.md`

**Interfaces:**
- Consumes: Task 4의 출력 ② 구조(SSOT).
- Produces: Phase D 회귀 기준(3역량).

**변환 규칙 (5축 → 3역량, 전 케이스 공통):**
- `학업역량` → `academic`, `진로역량` → `career`, `공동체역량`·`인성` → `community`(인성 관찰은 `성실성과 규칙준수`/`나눔과 배려` 항목으로 이전).
- `기타`(독서/본인의견) 축 → **삭제**(필요 시 관찰을 academic `탐구력` 또는 career `진로 탐색 활동과 경험`의 근거로 흡수. 단 보완 *추천*으로 독서 신설 금지 — #20).
- 각 역량: `summary`(정성) + 두드러진 항목 1~3개를 `◎강점`/`△보완`로 + 각 항목 근거(섹션 prefix) + `next_steps`(학생 본인·앞으로).
- 점수 표기(강함/보통/약함) 전면 삭제.

- [ ] **Step 1: case-01 (park-junho) 기대 출력 ② 교체**

`docs/golden/case-01-park-junho.md`의 "## 기대 출력 ② 생기부 진단 가이드" 섹션 본문을 Task 3 mock의 3역량 내용과 동일 구조로 교체:
```
## 기대 출력 ② 생기부 진단 가이드 (정의 §4-2)

3역량 × (정성 요약 · 강점/보완 항목 하이라이트[근거 포함] · 앞으로 할 활동)

### 학업역량 — 교과 성취와 탐구 기록이 탄탄
- ◎ 강점 · 학업성취도 — 정보·수학 성취도 우수, 세특 기록 구체적. 근거: 세특-정보(자료구조 발표), 세특-수학(미적분 응용)
- ◎ 강점 · 탐구력 — 학습 결과를 발표로 확장. 근거: 세특-정보(자료구조·알고리즘 학습)
- △ 보완 · 학업태도 — 자기주도 학습 과정 기록이 더 드러나면 좋음. 근거: 교과-정보
- 앞으로: 심화 학습을 진로 활동·정리로 본인이 연결해 일관성을 만들 것.

### 진로역량 — 방향은 분명하나 직접 시도 기록 보강 필요
- ◎ 강점 · 전공(계열) 관련 교과 이수 노력 — 전공 관련 교과 충실 이수. 근거: 교과-정보, 교과-수학
- △ 보완 · 진로 탐색 활동과 경험 — 본인 주도 산출물 기록이 적음. 근거: 진로활동-진로탐색 보고서(소프트웨어 엔지니어)
- 앞으로: 동아리 산출물·코드를 본인이 정리해 시도와 학습을 보여줄 것.

### 공동체역량 — 성실성 안정, 역할 정리 보강 필요
- ◎ 강점 · 성실성과 규칙준수 — 담임·교과 평가 일관. 근거: 행특(성실·책임감 일관)
- △ 보완 · 협업과 소통능력 — 역할·갈등 해결 과정의 본인 정리 부족. 근거: 수행평가 팀 과제, 창체-동아리(발표 준비)
- 앞으로: 팀 작업에서 본인 역할·기여를 한두 줄로 직접 정리할 것.
```

- [ ] **Step 2: case-02 ~ case-05 기대 출력 ② 교체**

각 파일을 열어 기존 "기대 출력 ② … 5항목" 섹션의 관찰 내용을 위 변환 규칙으로 3역량 구조로 재작성한다. 각 케이스의 학교유형·계열 보정(예: case-03 외고·의치한, case-04 자사고·예체능, case-05 검정고시)은 유지하되 축만 3역량으로 바꾼다. 구조 템플릿은 Step 1과 동일(역량명 — 정성 요약 / ◎강점·△보완 항목[근거] / 앞으로).

Run(각 파일 편집 후): `grep -nE "강함|보통|약함|인성|기타" docs/golden/case-0*.md`
Expected: 진단 출력 ② 섹션에서 매치 0건(있다면 잔재 → 제거). NG 셋 섹션의 *금지어 정의*로서의 언급은 허용.

- [ ] **Step 3: 각 케이스 NG 셋 보강**

각 case 파일의 "## §6 가드 위반 후보 키워드 (NG 셋)"에 공통 항목 추가:
```
- 진단 출력에 '인성'·'기타'를 별도 항목/축으로 출력 → NG (#19)
- 진단 출력에 '강함/보통/약함' 등급 라벨 → NG (#19)
```

- [ ] **Step 4: README §2 구조 설명 갱신**

`docs/golden/README.md` §2의 케이스 파일 구조 블록에서 출력 ② 설명 줄을 교체:
```
## 기대 출력 ② 생기부 진단 가이드 (정의 §4-2)
3역량(학업·진로·공동체) × (정성 요약 · 강점/보완 항목 하이라이트[근거] · 앞으로 할 활동)
※ '인성'·'기타' 축 없음(인성=공동체역량 흡수). 등급(강함/보통/약함) 없음.
```

- [ ] **Step 5: 게이트 검증 + 커밋**

Run: `just check`
Expected: 통과(문서 변경, 코드 무영향).
**EPO 검수 게이트:** EPO 승인 전 머지 금지.
```bash
git add docs/golden/
git commit -m "docs(golden): 회귀 5케이스 진단 출력을 3역량 구조로 전환 (#19)

EPO(최선혜) 검수 필요: golden 회귀 기준 변경.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (작성자 점검)

**Spec coverage:**
- 데이터 모델(spec §4) → Task 2 ✓ · UI(§5) → Task 3 ✓ · 프롬프트(§6) → Task 4 ✓ · 정의/골든(§7) → Task 4·5 ✓ · 테스트(§8) → Task 1·2 ✓(+Task 3 컴파일타임 conformance) · 작업순서/EPO 게이트(§9) → Task 4·5에 명시 ✓ · schema_version 0.2(§4.4) → Task 2 상수 + Task 4 문서 ✓.
- 비목표(#20 독서/미반영, #6 면접, 항목점수화) → 본 플랜 미포함 ✓(Task 5 Step 2에 #20 경계 명시).

**Placeholder scan:** "TBD/적절히/유사하게" 없음. Task 5 Step 2는 "유사"가 아니라 명시적 변환 규칙 + Step 1 worked example 기반(케이스 02~05 본문은 EPO 소유 실데이터라 파일을 열어 규칙 적용; 규칙은 결정적).

**Type consistency:** `DiagnosisGuide`/`competencyLabel`/`COMPETENCY_ITEMS`/`itemFlagEnum`/`SECTION_PREFIX_RE`/`DIAGNOSIS_SCHEMA_VERSION` 이름이 Task 2 정의와 Task 3 사용에서 일치. mock `flag` 값 `'strength'|'gap'`, `competency` 값 `'academic'|'career'|'community'`가 enum과 일치. evidence 문자열 전부 `SECTION_PREFIX_RE` 통과(세특·교과·진로활동·행특·수행평가·창체 prefix).

**리스크:** 입력 스키마 불변 → submit/consent/processing 회귀 없음. SSOT 문서는 EPO 게이트로 보호.
