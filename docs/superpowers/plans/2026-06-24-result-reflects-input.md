# 결과 화면 실입력 반영 + 데모 정직성 Implementation Plan (#25)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 제출한 표시용 입력(학년·학기·학교유형·계열·목표대학)을 sessionStorage로 `/result`에 전달해 헤더를 실입력으로 렌더하고, mock 본문을 "예시 결과(데모)"로 명확히 라벨하며, 면접 팩에 "데모 3건 · 실서비스 10종" 라벨을 단다.

**Architecture:** 비-PII 헤더 필드만 sessionStorage에 저장. 직렬화 스키마와 라벨 포맷은 `packages/shared`의 순수 함수(테스트 가능), 브라우저 sessionStorage I/O는 `apps/web/lib/submitted-profile.ts` 얇은 래퍼. 결과 페이지는 마운트 후 로드해 헤더에 반영하고 없으면 데모 fallback.

**Tech Stack:** TypeScript 5.5.4, Zod ^3.23.8, Vitest ^2.1(이미 도입, #19), React 18 / Next 14.

## Global Constraints

- **저장은 비-PII 헤더 필드만:** grade·semester·schoolType·targetTrack·targetUniversities. **생기부 text·마스킹 필드는 저장 금지**(#17 PII 정책 정합).
- 헤더 계열은 `targetTrackLabel` 단일 소스 — 하드코딩 "공학계열" 제거.
- 본문(면접·진단·보완)은 mock 그대로 + "예시 결과(데모)" 배너. 면접 3건 유지 + "데모 미리보기 3건 · 실서비스는 예상 질문 10종" 라벨.
- 프로필 없음(직접 /result 진입)·sessionStorage 비가용·parse 실패 → `null` → "예시 학생 (데모)" fallback 라벨(깨지지 않음).
- 입력 `studentProfileSchema`·기존 흐름 불변. node>=20.11, pnpm 9.7.0, zod ^3.23.8.

## File Structure

| 파일 | 책임 | 태스크 |
|---|---|---|
| `packages/shared/src/submitted-profile.ts` (생성) | 직렬화 스키마 + `formatStandingLabel` | 1 |
| `packages/shared/src/submitted-profile.test.ts` (생성) | 단위테스트 | 1 |
| `packages/shared/src/index.ts` (수정) | barrel export | 1 |
| `apps/web/lib/submitted-profile.ts` (생성) | sessionStorage 래퍼(save/load) | 2 |
| `apps/web/app/submit/page.tsx` (수정) | 제출 성공 시 save | 2 |
| `apps/web/app/result/page.tsx` (수정) | load·헤더·샘플 배너·면접 라벨 | 3 |

---

### Task 1: 직렬화 스키마 + 라벨 (`packages/shared`)

**Files:**
- Create: `packages/shared/src/submitted-profile.ts`, `packages/shared/src/submitted-profile.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: 기존 `schoolTypeEnum`/`targetTrackEnum`/`schoolTypeLabel`/`targetTrackLabel`/`targetUniversitySchema` (schemas.ts).
- Produces (Task 2·3 의존):
  - `submittedProfileSchema` (Zod)
  - `type SubmittedProfile`
  - `formatStandingLabel(p: SubmittedProfile): string`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `packages/shared/src/submitted-profile.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { submittedProfileSchema, formatStandingLabel } from './submitted-profile';

const valid = {
  grade: 3,
  semester: 2,
  schoolType: 'general',
  targetTrack: 'humanities',
  targetUniversities: [],
};

describe('submittedProfileSchema', () => {
  it('정상 프로필 통과', () =>
    expect(submittedProfileSchema.safeParse(valid).success).toBe(true));
  it('잘못된 계열 enum 실패', () =>
    expect(submittedProfileSchema.safeParse({ ...valid, targetTrack: 'xxx' }).success).toBe(false));
  it('학년 누락 실패', () => {
    const { grade, ...rest } = valid;
    expect(submittedProfileSchema.safeParse(rest).success).toBe(false);
  });
  it('목표대학 4개 초과 실패', () =>
    expect(
      submittedProfileSchema.safeParse({
        ...valid,
        targetUniversities: [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }],
      }).success
    ).toBe(false));
});

describe('formatStandingLabel', () => {
  it('인문·일반고', () =>
    expect(formatStandingLabel(valid)).toBe('고3 2학기 · 일반고 · 인문'));
  it('이공·특목고', () =>
    expect(
      formatStandingLabel({
        ...valid,
        schoolType: 'special_purpose',
        targetTrack: 'science_engineering',
      })
    ).toBe('고3 2학기 · 특목고 · 이공'));
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @pullim/shared test`
Expected: FAIL — `Cannot find module './submitted-profile'`.

- [ ] **Step 3: 구현**

Create `packages/shared/src/submitted-profile.ts`:
```ts
// Pullim Admissions Coach — 결과 화면 헤더용 표시 프로필 (#25)
// sessionStorage에 저장되는 *비-PII* 헤더 필드만. 생기부 text·마스킹 필드는 포함하지 않는다.

import { z } from 'zod';
import {
  schoolTypeEnum,
  targetTrackEnum,
  schoolTypeLabel,
  targetTrackLabel,
  targetUniversitySchema,
} from './schemas';

export const submittedProfileSchema = z.object({
  grade: z.number().int().min(1).max(3),
  semester: z.union([z.literal(1), z.literal(2)]),
  schoolType: schoolTypeEnum,
  targetTrack: targetTrackEnum,
  targetUniversities: z.array(targetUniversitySchema).max(3),
});

export type SubmittedProfile = z.infer<typeof submittedProfileSchema>;

export function formatStandingLabel(p: SubmittedProfile): string {
  return `고${p.grade} ${p.semester}학기 · ${schoolTypeLabel[p.schoolType]} · ${targetTrackLabel[p.targetTrack]}`;
}
```

- [ ] **Step 4: barrel export**

`packages/shared/src/index.ts` 끝에 추가:
```ts
export * from './submitted-profile';
```

- [ ] **Step 5: 테스트 통과 + 타입체크**

Run: `pnpm --filter @pullim/shared test && pnpm --filter @pullim/shared typecheck`
Expected: 본 태스크 6건 + 기존 테스트 전부 pass, typecheck 무에러.

- [ ] **Step 6: 커밋**

```bash
git add packages/shared/src/submitted-profile.ts packages/shared/src/submitted-profile.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): 결과 헤더용 표시 프로필 스키마 + formatStandingLabel (#25)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: sessionStorage 래퍼 + 제출 저장 (`apps/web`)

**Files:**
- Create: `apps/web/lib/submitted-profile.ts`
- Modify: `apps/web/app/submit/page.tsx`

**Interfaces:**
- Consumes: Task 1 `submittedProfileSchema`, `type SubmittedProfile`.
- Produces (Task 3 의존): `saveSubmittedProfile(p)`, `loadSubmittedProfile(): SubmittedProfile | null`, re-export `type SubmittedProfile`.

- [ ] **Step 1: sessionStorage 래퍼 생성**

Create `apps/web/lib/submitted-profile.ts`:
```ts
'use client';

import { submittedProfileSchema, type SubmittedProfile } from '@pullim/shared';

const STORAGE_KEY = 'pullim:submitted-profile';

export function saveSubmittedProfile(p: SubmittedProfile): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // sessionStorage 비가용(프라이빗 모드 등) — 데모 헤더만 영향, 무시.
  }
}

export function loadSubmittedProfile(): SubmittedProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = submittedProfileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export type { SubmittedProfile };
```

- [ ] **Step 2: 제출 성공 시 저장**

`apps/web/app/submit/page.tsx` 상단 import에 추가:
```ts
import { saveSubmittedProfile } from '@/lib/submitted-profile';
```
`handleSubmit`의 성공 분기(현재 `setErrors({});` 직후, `startTransition(...)` 직전)에 저장 호출 추가:
```tsx
    setErrors({});
    // #25: 결과 헤더 표시용 비-PII 프로필을 sessionStorage에 저장(생기부 text는 저장 안 함).
    saveSubmittedProfile({
      grade,
      semester,
      schoolType,
      targetTrack,
      targetUniversities: universities.filter((u) => u.name.trim().length > 0),
    });
    startTransition(() => {
      router.push('/consent');
    });
```

- [ ] **Step 3: 타입체크 + 빌드**

Run: `pnpm --filter @pullim/web typecheck && pnpm --filter @pullim/web build`
Expected: 무에러, 빌드 성공. (`grade/semester/schoolType/targetTrack/universities` 상태 타입이 `SubmittedProfile` 필드와 일치.)

- [ ] **Step 4: 커밋**

```bash
git add apps/web/lib/submitted-profile.ts apps/web/app/submit/page.tsx
git commit -m "feat(web): 제출 시 표시 프로필 sessionStorage 저장(비-PII) (#25)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 결과 페이지 — 헤더·샘플 배너·면접 라벨

**Files:**
- Modify: `apps/web/app/result/page.tsx`

**Interfaces:**
- Consumes: Task 2 `loadSubmittedProfile`, `type SubmittedProfile`; Task 1 `formatStandingLabel`.

- [ ] **Step 1: import + 프로필 로드**

`apps/web/app/result/page.tsx` 상단 import에 추가:
```ts
import { useEffect } from 'react';
import { loadSubmittedProfile, type SubmittedProfile } from '@/lib/submitted-profile';
import { competencyLabel, formatStandingLabel } from '@pullim/shared';
```
> 비고: 현재 `import { useState } from 'react';`와 `import { competencyLabel } from '@pullim/shared';`가 이미 있다. `useState` 줄에 `useEffect`를 추가하고, `competencyLabel` import에 `formatStandingLabel`를 합친다(중복 import 금지).

`ResultPage` 컴포넌트 본문 상단(`const [tab, setTab] = useState<Tab>('interview');` 아래)에 추가:
```tsx
  const [profile, setProfile] = useState<SubmittedProfile | null>(null);
  useEffect(() => {
    setProfile(loadSubmittedProfile());
  }, []);
```

- [ ] **Step 2: 헤더를 실입력으로 교체**

기존 헤더 문단(현 `<p className="mb-6 text-ink-700"> {parkJunho.identity.displayLabel} · 고3 2학기 · 공학계열 · 24시간 안에 1차 결과 도착 </p>`)을 다음으로 교체:
```tsx
        <p className="mb-2 text-ink-700">
          {profile
            ? `${formatStandingLabel(profile)} · 24시간 안에 1차 결과 도착`
            : '예시 학생 (데모) · 고3 2학기 · 이공 · 24시간 안에 1차 결과 도착'}
        </p>
        {profile && profile.targetUniversities.length > 0 && (
          <p className="mb-6 text-sm text-ink-500">
            목표:{' '}
            {profile.targetUniversities
              .map((u, i) => `${i + 1}순위 ${u.name}${u.department ? ` ${u.department}` : ''}`)
              .join(' · ')}
          </p>
        )}
```
> 하드코딩 "공학계열"이 제거되고 계열은 `formatStandingLabel`(= `targetTrackLabel`) 단일 소스가 된다.

- [ ] **Step 3: 샘플 본문 배너 추가**

`<GuardrailLabel ... className="mb-6" />` 바로 아래(탭 `<div role="tablist">` 위)에 추가:
```tsx
        <aside
          role="note"
          className="mb-6 rounded-2xl border border-ink-100 bg-ink-100/50 px-4 py-3 text-sm leading-relaxed text-ink-600"
        >
          아래 면접·진단·보완{' '}
          <strong className="text-ink-900">본문은 예시 결과(데모)</strong>입니다. 실제 개인화
          결과는 출시 버전에서 제공됩니다.
        </aside>
```

- [ ] **Step 4: 면접 팩 라벨 추가**

`InterviewPanel`의 `return (<section className="space-y-4">` 바로 다음(첫 자식)으로 라벨 문단을 추가:
```tsx
    <section className="space-y-4">
      <p className="text-sm text-ink-500">
        데모 미리보기 3건 · 실서비스는 예상 질문 10종
      </p>
      {parkJunho.interviewPack.questions.map((q, idx) => (
```

- [ ] **Step 5: 타입체크 + 빌드**

Run: `pnpm --filter @pullim/web typecheck && pnpm --filter @pullim/web build`
Expected: 무에러, 빌드 성공.

- [ ] **Step 6: 수동 확인**

Run: `pnpm --filter @pullim/web dev`
확인: (a) `/submit`에서 계열=인문, 고2 1학기, 목표대학 입력 후 제출→동의→처리→`/result` 헤더가 "고2 1학기 · 일반고 · 인문" + 목표대학 표시; (b) 브라우저에서 `/result` 직접 진입 시 "예시 학생 (데모) · 고3 2학기 · 이공" fallback; (c) 샘플 배너·면접 "데모 3건 · 실서비스 10종" 라벨 노출; (d) 헤더에 "공학계열" 문구 없음.

- [ ] **Step 7: 커밋**

```bash
git add apps/web/app/result/page.tsx
git commit -m "feat(web): 결과 헤더 실입력 반영 + 샘플 본문 배너 + 면접 데모 라벨 (#25)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (작성자 점검)

**Spec coverage:**
- §4 데이터 threading(shared 스키마+라벨, web 래퍼) → Task 1·2 ✓
- §5 헤더 실입력+fallback → Task 3 Step 1·2 ✓
- §6 본문 정직성(샘플 배너 + 면접 라벨) → Task 3 Step 3·4 ✓
- §7 영향 파일 전부 매핑 ✓ · §8 테스트(shared 단위 + web typecheck/build/수동) → Task 1·2·3 ✓
- 비-PII 저장(생기부 text 제외) → Task 2 save 호출이 헤더 필드만 전달 ✓ · 하드코딩 "공학계열" 제거 → Task 3 Step 2 ✓

**Placeholder scan:** "TBD/적절히" 없음. 모든 코드 step에 완전한 코드.

**Type consistency:** `SubmittedProfile`(grade·semester·schoolType·targetTrack·targetUniversities)·`submittedProfileSchema`·`formatStandingLabel`·`saveSubmittedProfile`·`loadSubmittedProfile` 이름이 Task 1→2→3에서 일치. submit 상태(`grade`number·`semester`1|2·`schoolType`SchoolType·`targetTrack`TargetTrack·`universities`{name,department?}[])가 `SubmittedProfile` 필드와 타입 일치.

**리스크:** SSR/hydration — `profile` 초기값 null이라 서버·첫 클라 렌더가 동일(fallback), `useEffect`가 마운트 후 갱신 → mismatch 없음. sessionStorage 비가용·parse 실패 → null → fallback. `feat/20` 스택 → #19·#20 머지 후 #25 머지.
