# 생기부 PII 자동 검출·가림 Implementation Plan (#17)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 생기부 제출 직전(및 입력 중) 클라이언트에서 PII를 자동 검출해 고정밀(전화·주민번호·이메일·학교명)은 제출을 하드 차단하고, 저정밀(이름·교사·생년월일·주소)은 경고+2차 확인하며, 원클릭 자동 가림으로 카테고리 플레이스홀더 치환을 제공한다.

**Architecture:** 검출/치환은 `packages/shared/src/pii.ts` 순수 함수(`detectPii`/`redactPii`/`hasBlockingPii`). `recordSchema`가 block-tier 검출 시 invalid(superRefine)로 클라·서버 동일 게이트. `apps/web` submit 페이지는 라이브 스캔 패널·자동 가림·티어드 제출 게이트로 이 함수만 호출(정규식 중복 없음).

**Tech Stack:** TypeScript 5.5.4, Zod ^3.23.8, Vitest ^2.1, React 18 / Next 14, pnpm 9.7 workspace.

## Global Constraints

> 모든 태스크에 암묵 포함. 값은 spec에서 그대로 옮김.

- **티어 배치(불변):** block = `phone`·`rrn`·`email`·`school` (하드 차단). warn = `name`·`teacher`·`birth_date`·`address` (경고+2차 확인, 스키마 차단 안 함).
- **이름/교사 검출은 라벨 인접 문맥 앵커만** (`이름:`/`성명`/`담임`/`교사`/`○○ 선생님`/`○○ 학생|군|양`). 자유 2~4자 매칭 금지.
- **자동 가림:** 검출 토큰을 카테고리 플레이스홀더(`[전화]`·`[주민번호]`·`[이메일]`·`[학교]`·`[이름]`·`[교사]`·`[생년월일]`·`[주소]`)로 치환. **라벨 보존**(라벨이 아니라 민감 토큰만 치환), **idempotent**(재실행/재검출 안전).
- **block-tier만** 스키마 하드 게이트(`recordSchema` superRefine, `path:['text']`). warn은 UI에서만.
- `maskedFieldEnum`에 `email` 추가. category→maskedField 매핑: phone→phone, rrn→resident_registration_no, email→email, school→school_name, name→student_name, teacher→teacher_name, birth_date→birth_date, address→address.
- 입력 `SCHEMA_VERSION` `0.1` 불변. 입력 흐름(submit→consent→processing) 유지.
- detector는 `packages/shared` 순수 함수(서버 재사용). UI는 표현 전담 — 정규식·tier 로직 중복 금지.
- 런타임: node>=20.11, pnpm 9.7.0, zod ^3.23.8, vitest ^2.1.

## File Structure

| 파일 | 책임 | 태스크 |
|---|---|---|
| `packages/shared/vitest.config.ts` (생성) | 테스트 러너 설정 | 1 |
| `packages/shared/package.json`·`package.json`·`justfile` (수정) | vitest + `just test` 배선 | 1 |
| `packages/shared/src/pii.ts` (생성) | PII 검출/치환 순수 함수 | 2 |
| `packages/shared/src/pii.test.ts` (생성) | detector 단위테스트 | 2 |
| `packages/shared/src/schemas.ts` (수정) | `email` enum + recordSchema superRefine | 3 |
| `packages/shared/src/schemas.test.ts` (생성) | block-tier 게이트 테스트 | 3 |
| `packages/shared/src/index.ts` (수정) | pii barrel export | 3 |
| `apps/web/components/pii-scan-panel.tsx` (생성) | 검출 결과·자동 가림 UI | 4 |
| `apps/web/app/submit/page.tsx` (수정) | 라이브 스캔·티어드 게이트·maskedFields 연동 | 4 |
| `README.md` / `docs/006_...policy_v0.1.md` (수정 1줄) | "기본 강제" 문구 정합 | 5 |

---

### Task 1: 테스트 러너(vitest) 도입 + 배선

> ⚠️ 이 브랜치는 `main`에서 분기되어 vitest가 없다(#19 브랜치에만 있음). 본 태스크가 다시 도입한다. #19와 머지 시 `vitest.config.ts`/`package.json`/`justfile`이 겹치나 내용 동일이라 충돌 해소는 사소하다.

**Files:**
- Create: `packages/shared/vitest.config.ts`, `packages/shared/src/consent.smoke.test.ts`
- Modify: `packages/shared/package.json`, `package.json`, `justfile`

**Interfaces:**
- Produces: `pnpm --filter @pullim/shared test`, `just test` 동작.

- [ ] **Step 1: vitest 설치**

Run: `pnpm --filter @pullim/shared add -D vitest@^2.1.0`
Expected: `packages/shared/package.json` devDependencies에 `vitest` 추가, lockfile 갱신.

- [ ] **Step 2: vitest 설정**

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

- [ ] **Step 3: `test` 스크립트 (shared)**

`packages/shared/package.json`의 `"scripts"`를 다음으로:
```json
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
```

- [ ] **Step 4: 루트·justfile 배선**

루트 `package.json` `"scripts"`에 추가:
```json
    "test": "pnpm --filter @pullim/shared test",
```
`justfile` 끝에 추가:
```make
test:
    pnpm test
```
`justfile`의 `check:` 타깃을 다음으로:
```make
check:
    pnpm lint
    pnpm typecheck
    pnpm test
```

- [ ] **Step 5: 러너 증명 테스트 (실패 먼저)**

Create `packages/shared/src/consent.smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { consentSchema } from './schemas';

describe('consentSchema (러너 동작 확인)', () => {
  it('미성년자는 법정대리인 동의 없으면 실패한다', () => {
    const r = consentSchema.safeParse({
      isMinor: true, termsAgreed: true, privacyPolicyAgreed: true,
      guardianConsentObtained: false, consentTimestamp: '2026-06-23T00:00:00.000Z',
    });
    expect(r.success).toBe(false);
  });
  it('필수 동의가 모두 true면 통과한다', () => {
    const r = consentSchema.safeParse({
      isMinor: false, termsAgreed: true, privacyPolicyAgreed: true,
      guardianConsentObtained: false, consentTimestamp: '2026-06-23T00:00:00.000Z',
    });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 6: 실행 → 통과**

Run: `pnpm --filter @pullim/shared test`
Expected: 2 passed.

- [ ] **Step 7: 커밋**

```bash
git add packages/shared/vitest.config.ts packages/shared/package.json packages/shared/src/consent.smoke.test.ts package.json justfile pnpm-lock.yaml
git commit -m "test: vitest 러너 도입 + just test 배선 (#17)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: PII detector (`packages/shared/src/pii.ts`)

**Files:**
- Create: `packages/shared/src/pii.ts`, `packages/shared/src/pii.test.ts`

**Interfaces:**
- Produces (Task 3·4 의존, 정확한 이름·타입):
  - `type PiiCategory = 'phone'|'rrn'|'email'|'school'|'name'|'teacher'|'birth_date'|'address'`
  - `type PiiTier = 'block'|'warn'`
  - `interface PiiMatch { category: PiiCategory; tier: PiiTier; index: number; length: number; value: string; placeholder: string; maskedField: string }`
  - `detectPii(text: string): PiiMatch[]`
  - `redactPii(text: string, matches: PiiMatch[]): string`
  - `hasBlockingPii(text: string): boolean`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `packages/shared/src/pii.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { detectPii, redactPii, hasBlockingPii } from './pii';

const cats = (t: string) => detectPii(t).map((m) => m.category).sort();

describe('detectPii — block tier (고정밀)', () => {
  it('휴대전화 검출', () => expect(cats('연락처 010-1234-5678')).toContain('phone'));
  it('주민등록번호 검출', () => expect(cats('980101-1234567')).toContain('rrn'));
  it('이메일 검출', () => expect(cats('메일 hong@example.com 으로')).toContain('email'));
  it('학교명 검출', () => expect(cats('서울고등학교 재학')).toContain('school'));
  it('block tier로 분류', () => {
    expect(detectPii('010-1234-5678').every((m) => m.tier === 'block')).toBe(true);
    expect(hasBlockingPii('서울고등학교')).toBe(true);
  });
});

describe('detectPii — warn tier (문맥 앵커)', () => {
  it('이름: 라벨 인접', () => expect(cats('이름: 홍길동')).toContain('name'));
  it('○○ 학생', () => expect(cats('김철수 학생은 성실하다')).toContain('name'));
  it('담임 라벨', () => expect(cats('담임 박영희')).toContain('teacher'));
  it('○○ 선생님', () => expect(cats('이순신 선생님께')).toContain('teacher'));
  it('생년월일', () => expect(cats('생년월일 2008.03.15')).toContain('birth_date'));
  it('주소', () => expect(cats('서울시 강남구 역삼동')).toContain('address'));
  it('warn은 hasBlockingPii=false', () => expect(hasBlockingPii('이름: 홍길동')).toBe(false));
});

describe('detectPii — 음성(false positive 방지)', () => {
  it('라벨 없는 일반 한글어는 미검출', () => {
    expect(detectPii('자료구조와 동아리 활동을 2년 연속 했다')).toHaveLength(0);
  });
  it('라벨 없는 이름 후보 단독은 미검출', () => {
    expect(detectPii('프로젝트를 주도했다')).toHaveLength(0);
  });
  it('이미 치환된 플레이스홀더는 재검출 안 함', () => {
    expect(detectPii('[이름]은 [학교]에서 [전화]로')).toHaveLength(0);
  });
});

describe('redactPii', () => {
  it('라벨 보존하고 토큰만 치환', () => {
    const t = '이름: 홍길동';
    expect(redactPii(t, detectPii(t))).toBe('이름: [이름]');
  });
  it('다중 매치 치환', () => {
    const t = '서울고등학교 010-1234-5678';
    const r = redactPii(t, detectPii(t));
    expect(r).toContain('[학교]');
    expect(r).toContain('[전화]');
    expect(r).not.toMatch(/\d{4}/);
  });
  it('idempotent — 재실행 시 변화 없음', () => {
    const t = '연락처 010-1234-5678';
    const once = redactPii(t, detectPii(t));
    expect(redactPii(once, detectPii(once))).toBe(once);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @pullim/shared test`
Expected: FAIL — `Cannot find module './pii'`.

- [ ] **Step 3: 구현**

Create `packages/shared/src/pii.ts`:
```ts
// Pullim Admissions Coach — 생기부 PII 검출/치환 (#17)
// 순수 함수. 클라(submit UI)와 Phase C 서버(NestJS pipe)가 동일하게 재사용.
// 티어: block(고정밀, 하드 차단) / warn(문맥 앵커, 경고). 이름·교사는 라벨 인접만.

export type PiiCategory =
  | 'phone' | 'rrn' | 'email' | 'school'
  | 'name' | 'teacher' | 'birth_date' | 'address';
export type PiiTier = 'block' | 'warn';

export interface PiiMatch {
  category: PiiCategory;
  tier: PiiTier;
  index: number;   // 민감 토큰 시작(라벨 제외)
  length: number;
  value: string;
  placeholder: string;
  maskedField: string; // maskedFieldEnum 값
}

const PLACEHOLDER: Record<PiiCategory, string> = {
  phone: '[전화]', rrn: '[주민번호]', email: '[이메일]', school: '[학교]',
  name: '[이름]', teacher: '[교사]', birth_date: '[생년월일]', address: '[주소]',
};
const MASKED_FIELD: Record<PiiCategory, string> = {
  phone: 'phone', rrn: 'resident_registration_no', email: 'email', school: 'school_name',
  name: 'student_name', teacher: 'teacher_name', birth_date: 'birth_date', address: 'address',
};
const TIER: Record<PiiCategory, PiiTier> = {
  phone: 'block', rrn: 'block', email: 'block', school: 'block',
  name: 'warn', teacher: 'warn', birth_date: 'warn', address: 'warn',
};

// group: 민감 토큰이 들어있는 캡처그룹 번호(0 = 전체 매치). 'd'(hasIndices) 플래그로 위치 추출.
interface Rule { category: PiiCategory; re: RegExp; group: number }
const RULES: Rule[] = [
  { category: 'rrn',     re: /\d{6}-?[1-4]\d{6}/gd, group: 0 },
  { category: 'phone',   re: /01[016789]-?\d{3,4}-?\d{4}/gd, group: 0 },
  { category: 'phone',   re: /0\d{1,2}-\d{3,4}-\d{4}/gd, group: 0 },
  { category: 'email',   re: /[\w.+-]+@[\w-]+\.[\w.-]+/gd, group: 0 },
  { category: 'school',  re: /[가-힣]{2,}(?:초등학교|중학교|고등학교|대학교)/gd, group: 0 },
  { category: 'name',    re: /(?:이름|성명)\s*[:：]?\s*([가-힣]{2,4})/gd, group: 1 },
  { category: 'name',    re: /([가-힣]{2,4})\s*(?:학생|군|양)(?![가-힣])/gd, group: 1 },
  { category: 'teacher', re: /(?:담임|교사)\s*[:：]?\s*([가-힣]{2,4})/gd, group: 1 },
  { category: 'teacher', re: /([가-힣]{2,4})\s*선생님/gd, group: 1 },
  { category: 'birth_date', re: /\d{4}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}\s*일?/gd, group: 0 },
  { category: 'address', re: /[가-힣]+(?:시|도)\s?[가-힣]+(?:시|군|구)\s?[가-힣]+(?:읍|면|동|로|길)/gd, group: 0 },
];

export function detectPii(text: string): PiiMatch[] {
  const raw: PiiMatch[] = [];
  for (const rule of RULES) {
    for (const m of text.matchAll(rule.re)) {
      const span = (m as RegExpMatchArray & { indices?: Array<[number, number] | undefined> })
        .indices?.[rule.group];
      if (!span) continue;
      const [start, end] = span;
      raw.push({
        category: rule.category,
        tier: TIER[rule.category],
        index: start,
        length: end - start,
        value: text.slice(start, end),
        placeholder: PLACEHOLDER[rule.category],
        maskedField: MASKED_FIELD[rule.category],
      });
    }
  }
  // index 오름차순, 같은 시작이면 더 긴 매치 우선. 겹치는 매치는 앞선 것만 남긴다.
  raw.sort((a, b) => a.index - b.index || b.length - a.length);
  const out: PiiMatch[] = [];
  let lastEnd = -1;
  for (const m of raw) {
    if (m.index >= lastEnd) {
      out.push(m);
      lastEnd = m.index + m.length;
    }
  }
  return out;
}

export function redactPii(text: string, matches: PiiMatch[]): string {
  // 뒤에서 앞으로 치환 → 앞쪽 오프셋이 깨지지 않음.
  const sorted = [...matches].sort((a, b) => b.index - a.index);
  let out = text;
  for (const m of sorted) {
    out = out.slice(0, m.index) + m.placeholder + out.slice(m.index + m.length);
  }
  return out;
}

export function hasBlockingPii(text: string): boolean {
  return detectPii(text).some((m) => m.tier === 'block');
}
```

- [ ] **Step 4: 테스트 통과 + 타입체크**

Run: `pnpm --filter @pullim/shared test && pnpm --filter @pullim/shared typecheck`
Expected: pii 테스트 전부 pass(+smoke 2), typecheck 무에러.

- [ ] **Step 5: 커밋**

```bash
git add packages/shared/src/pii.ts packages/shared/src/pii.test.ts
git commit -m "feat(shared): PII 검출/치환 detector (#17)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 스키마 게이트 + barrel (`packages/shared`)

**Files:**
- Modify: `packages/shared/src/schemas.ts`, `packages/shared/src/index.ts`
- Create: `packages/shared/src/schemas.test.ts`

**Interfaces:**
- Consumes: Task 2 `hasBlockingPii`.
- Produces: `recordSchema`가 block-tier 포함 text_paste를 invalid 처리. `maskedFieldEnum`에 `email`. `@pullim/shared`에서 pii 함수 export.

- [ ] **Step 1: 실패하는 테스트 작성**

Create `packages/shared/src/schemas.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { recordSchema } from './schemas';

const base = { inputType: 'text_paste' as const, maskingApplied: true as const };

describe('recordSchema — block-tier PII 게이트', () => {
  it('전화번호가 남은 text는 invalid', () => {
    const r = recordSchema.safeParse({ ...base, text: '연락처 010-1234-5678' });
    expect(r.success).toBe(false);
  });
  it('학교명이 남은 text는 invalid', () => {
    const r = recordSchema.safeParse({ ...base, text: '서울고등학교 재학 중' });
    expect(r.success).toBe(false);
  });
  it('warn-tier만(이름) 있으면 valid (스키마는 차단 안 함)', () => {
    const r = recordSchema.safeParse({ ...base, text: '이름: 홍길동, 동아리 활동 우수' });
    expect(r.success).toBe(true);
  });
  it('PII 없는 text는 valid', () => {
    const r = recordSchema.safeParse({ ...base, text: '자료구조 발표와 동아리 활동' });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @pullim/shared test`
Expected: FAIL — block-tier 케이스가 아직 success=true (게이트 미구현).

- [ ] **Step 3: `email` enum 추가**

`packages/shared/src/schemas.ts`의 `maskedFieldEnum`에 `'email'` 추가:
```ts
export const maskedFieldEnum = z.enum([
  'student_name',
  'school_name',
  'birth_date',
  'resident_registration_no',
  'phone',
  'address',
  'teacher_name',
  'email',
  'other',
]);
```

- [ ] **Step 4: import + superRefine 게이트**

`packages/shared/src/schemas.ts` 상단 import에 추가:
```ts
import { hasBlockingPii } from './pii';
```
`recordSchema` 정의(현 `export const recordSchema = z.discriminatedUnion('inputType', [...])`)에 `.superRefine`를 체이닝:
```ts
export const recordSchema = z
  .discriminatedUnion('inputType', [
    z.object({
      inputType: z.literal('pdf_upload'),
      fileRef: z.string().min(1, '파일을 업로드해주세요'),
      ...baseRecord,
    }),
    z.object({
      inputType: z.literal('text_paste'),
      text: z
        .string()
        .min(1, '생기부 텍스트를 입력해주세요')
        .max(200000, '본문이 너무 깁니다(최대 20만 자)'),
      ...baseRecord,
    }),
  ])
  .superRefine((rec, ctx) => {
    // block-tier(전화·주민번호·이메일·학교명) 잔존 시 제출 차단. warn-tier는 UI 처리.
    if (rec.inputType === 'text_paste' && hasBlockingPii(rec.text)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['text'],
        message: '전화·주민번호·이메일·학교명 등 식별정보가 남아있어요. 자동 가림을 적용해주세요.',
      });
    }
  });
```

- [ ] **Step 5: barrel export**

`packages/shared/src/index.ts`를 다음으로:
```ts
// Pullim Admissions Coach — shared barrel.
// Phase B: Zod schemas synced with docs/student_profile_schema_v0.1.json.
// Phase D: AI output DTOs synced with definition v0.3 §4.

export * from './schemas';
export * from './pii';
```

- [ ] **Step 6: 테스트 통과 + 타입체크**

Run: `pnpm --filter @pullim/shared test && pnpm --filter @pullim/shared typecheck`
Expected: schemas 4건 + pii + smoke 전부 pass, typecheck 무에러.

- [ ] **Step 7: 커밋**

```bash
git add packages/shared/src/schemas.ts packages/shared/src/schemas.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): recordSchema block-tier PII 게이트 + email enum (#17)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: submit UI — 라이브 스캔·자동 가림·티어드 게이트

**Files:**
- Create: `apps/web/components/pii-scan-panel.tsx`
- Modify: `apps/web/app/submit/page.tsx`

**Interfaces:**
- Consumes: `detectPii`, `redactPii`, `type PiiMatch` from `@pullim/shared`.
- Produces: 제출 게이트(block 차단 / warn 2차 확인) + `maskedFields` 자동 채움.

- [ ] **Step 1: 스캔 패널 컴포넌트 생성**

Create `apps/web/components/pii-scan-panel.tsx`:
```tsx
'use client';

import type { PiiMatch } from '@pullim/shared';
import { cn } from '@/lib/utils';

const CATEGORY_LABEL: Record<string, string> = {
  phone: '전화', rrn: '주민번호', email: '이메일', school: '학교명',
  name: '이름', teacher: '교사', birth_date: '생년월일', address: '주소',
};

function summarize(matches: PiiMatch[]) {
  const counts = new Map<string, number>();
  for (const m of matches) counts.set(m.category, (counts.get(m.category) ?? 0) + 1);
  return [...counts.entries()].map(([cat, n]) => `${CATEGORY_LABEL[cat] ?? cat} ${n}`);
}

export function PiiScanPanel({
  matches,
  onAutoRedact,
}: {
  matches: PiiMatch[];
  onAutoRedact: () => void;
}) {
  if (matches.length === 0) {
    return (
      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/40 px-4 py-3 text-sm text-emerald-800">
        ✓ 식별정보로 의심되는 항목이 발견되지 않았습니다.
      </div>
    );
  }
  const block = matches.filter((m) => m.tier === 'block');
  const warn = matches.filter((m) => m.tier === 'warn');
  return (
    <div
      className={cn(
        'mt-3 rounded-xl border px-4 py-3 text-sm',
        block.length ? 'border-rose-200 bg-rose-50/50' : 'border-amber-200 bg-amber-50/50'
      )}
      role="status"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-ink-900">
          {block.length > 0
            ? `🔴 반드시 가려야 할 식별정보 ${block.length}건`
            : `🟡 확인이 필요한 항목 ${warn.length}건`}
        </p>
        <button
          type="button"
          onClick={onAutoRedact}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          자동 가림
        </button>
      </div>
      {block.length > 0 && (
        <p className="mt-1.5 text-xs text-rose-700">
          {summarize(block).join(' · ')} — 가리기 전에는 제출할 수 없어요.
        </p>
      )}
      {warn.length > 0 && (
        <p className="mt-1.5 text-xs text-amber-700">
          {summarize(warn).join(' · ')} — 이름·교사 등으로 보입니다. 자동 가림하거나, 식별정보가
          아니면 아래에서 확인 후 진행하세요.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: submit 페이지 — import + 상태 추가**

`apps/web/app/submit/page.tsx` 상단 import 블록에 추가:
```tsx
import { detectPii, redactPii, type PiiMatch } from '@pullim/shared';
import { PiiScanPanel } from '@/components/pii-scan-panel';
```
컴포넌트 본문의 상태 선언부(예: `const [maskedFields, setMaskedFields] = useState<string[]>([]);` 근처)에 추가:
```tsx
  const [piiMatches, setPiiMatches] = useState<PiiMatch[]>([]);
  const [warnAck, setWarnAck] = useState(false);
```

- [ ] **Step 3: 디바운스 스캔 effect + 파생값**

상태 선언부 아래에 추가(다른 `useEffect`들과 같은 위치):
```tsx
  // recordText 변경 시 300ms 디바운스로 PII 스캔. 변경되면 warn 확인은 초기화.
  useEffect(() => {
    setWarnAck(false);
    const id = setTimeout(() => setPiiMatches(detectPii(recordText)), 300);
    return () => clearTimeout(id);
  }, [recordText]);

  const blockMatches = piiMatches.filter((m) => m.tier === 'block');
  const warnMatches = piiMatches.filter((m) => m.tier === 'warn');

  function handleAutoRedact() {
    const matches = detectPii(recordText);
    setRecordText(redactPii(recordText, matches));
    setMaskedFields((prev) =>
      Array.from(new Set([...prev, ...matches.map((m) => m.maskedField)]))
    );
    setMaskingApplied(true);
  }
```

- [ ] **Step 4: 제출 게이트 수정**

`handleSubmit`의 본문 시작부(`setSubmitError(null);` 직후)에 티어드 게이트를 삽입:
```tsx
    // 티어드 PII 게이트. block은 하드 차단, warn은 2차 확인.
    const matches = detectPii(recordText);
    const block = matches.filter((m) => m.tier === 'block');
    const warn = matches.filter((m) => m.tier === 'warn');
    if (block.length > 0) {
      setSubmitError('전화·학교명 등 반드시 가려야 할 식별정보가 남아있어요. [자동 가림]을 눌러주세요.');
      const node = document.querySelector('[data-field-error="record.text"]') as HTMLElement | null;
      node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (warn.length > 0 && !warnAck) {
      setSubmitError('이름·교사로 보이는 항목이 있어요. 자동 가림하거나, 식별정보가 아니면 확인란을 체크해주세요.');
      return;
    }
    setMaskingApplied(true);
```
> 이후 기존 `validate(studentProfileSchema, buildPayload())` 흐름은 그대로 둔다. `buildPayload`의 `maskingApplied`/`maskedFields`는 위에서 채워진 값을 사용한다. block가 0이므로 `recordSchema` superRefine도 통과한다.

- [ ] **Step 5: MaskingChecklist → PiiScanPanel + 2차 확인으로 교체**

`<MaskingChecklist .../>` 사용 부분(생기부 입력 Field 내부)을 다음으로 교체:
```tsx
            <PiiScanPanel matches={piiMatches} onAutoRedact={handleAutoRedact} />

            {warnMatches.length > 0 && blockMatches.length === 0 && (
              <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/40 px-4 py-3">
                <input
                  type="checkbox"
                  checked={warnAck}
                  onChange={(e) => setWarnAck(e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 accent-brand-600"
                />
                <span className="text-sm text-ink-900">
                  표시된 항목은 식별정보가 아님을 확인했고, 이대로 진행합니다.
                </span>
              </label>
            )}
```
그리고 더 이상 쓰지 않는 `MaskingChecklist` 컴포넌트 정의와 `maskedFieldOptions` 상수를 파일에서 **삭제**한다(미사용 import·`toggleMaskedField`도 함께 정리). `maskedFields`/`setMaskedFields` 상태는 유지(자동 가림이 채움).

- [ ] **Step 6: 타입체크 + 빌드**

Run: `pnpm --filter @pullim/web typecheck && pnpm --filter @pullim/web build`
Expected: 무에러, 빌드 성공.

- [ ] **Step 7: 수동 확인**

Run: `pnpm --filter @pullim/web dev` → `http://localhost:3030/submit`
확인: (a) `010-1234-5678`·`서울고등학교` 붙여넣기 → 🔴 패널 + 제출 차단, (b) [자동 가림] → `[전화]`·`[학교]`로 치환 + 패널 초록, (c) `이름: 홍길동`만 → 🟡 + 확인란 체크해야 제출, (d) 깨끗한 텍스트 → 바로 제출.

- [ ] **Step 8: 커밋**

```bash
git add apps/web/components/pii-scan-panel.tsx apps/web/app/submit/page.tsx
git commit -m "feat(web): 제출 전 PII 라이브 스캔·자동 가림·티어드 게이트 (#17)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: 정책 문구 정합 + 회귀 확인

**Files:**
- Modify: `README.md`, `docs/006_Admissions_Coach_data_security_policy_v0.1.md`

- [ ] **Step 1: README/policy 문구 정합**

`README.md`의 가드레일 3번 "식별정보 마스킹 기본 강제" 문장에 실제 동작을 반영하는 한 절을 덧붙인다:
```
3. **미성년자 데이터 = 출시 차단 조건(P0).** 생기부는 미성년자 민감정보입니다. 식별정보 마스킹 기본 강제(제출 전 클라이언트 PII 자동 검출 — 전화·주민번호·이메일·학교명은 하드 차단, 이름·교사·주소·생년월일은 경고+확인), 법정대리인 동의 절차 + 보관·삭제 정책이 닫히기 전에는 출시하지 않습니다.
```
`docs/006_...policy_v0.1.md`의 "마스킹 강제" 항목(§ "마스킹 강제: ... `record.maskingApplied: true` const")에 한 줄 추가:
```
- **마스킹 자동 검출(#17, Phase B):** 입력 단계에서 `packages/shared/src/pii.ts`가 전화·주민번호·이메일·학교명을 하드 차단, 이름·교사·주소·생년월일을 경고+2차 확인. Phase C에서 동일 함수를 NestJS pipe로 서버 재검증.
```

- [ ] **Step 2: 회귀 확인(게이트)**

Run: `just check`
Expected: lint·typecheck·test(shared) 전부 통과.

- [ ] **Step 3: 커밋**

```bash
git add README.md docs/006_Admissions_Coach_data_security_policy_v0.1.md
git commit -m "docs(policy): PII 자동 검출 동작 반영 — 마스킹 '기본 강제' 정합 (#17)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (작성자 점검)

**Spec coverage:**
- §4 detector(detectPii/redactPii/hasBlockingPii, 티어·카테고리·매핑) → Task 2 ✓
- §5 스키마 게이트(block-tier superRefine, email enum) → Task 3 ✓
- §6 UI(라이브 스캔·자동 가림·티어드 게이트·maskedFields 연동) → Task 4 ✓
- §7 테스트(detector 양성/음성, redact 라벨보존/idempotent, 스키마 게이트) → Task 2·3 ✓
- §8 영향 파일 전부 태스크에 매핑 ✓ · 정책 문구 정합 → Task 5 ✓
- 테스트 러너 부재 → Task 1 ✓

**Placeholder scan:** "TBD/적절히" 없음. 모든 코드 step에 완전한 코드.

**Type consistency:** `PiiMatch`/`PiiCategory`/`PiiTier`/`detectPii`/`redactPii`/`hasBlockingPii`/`maskedField` 이름이 Task 2 정의와 Task 3·4 사용에서 일치. `maskedFieldEnum` email 추가가 pii.ts MASKED_FIELD(`email`)와 정합. UI `handleAutoRedact`/`warnAck`/`piiMatches`가 Task 3·4·5 사이 일관.

**리스크:**
- 한국어 정규식 `[가-힣]` + `d`(hasIndices) 플래그 — Node 20·모던 브라우저 지원. 테스트로 커버.
- warn-tier 이름 패턴은 문맥 앵커라도 오탐 가능("우리 학생"→"우리") — block 아님·자동가림 가역·2차확인이라 제출을 부당 차단하지 않음(설계 §9).
- Task 1 vitest 파일이 #19 브랜치와 겹침 — 머지 시 동일 내용이라 충돌 해소 사소.
- 입력 스키마 불변, 기존 흐름 유지.
