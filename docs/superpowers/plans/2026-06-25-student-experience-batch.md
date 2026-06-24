# 학생 경험 마무리 배치 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 면접 자기답변 작성·처리화면 사용자 문구·결과 저장/공유(PDF·이력·링크복사)를 mock으로 기능 완성한다.

**Architecture:** 단일 mock store `lib/result-store.ts`(localStorage)가 자기답변 + 저장된 결과를 관리. 결과 페이지에 자기답변 텍스트영역과 저장/공유 액션, 마이페이지는 result-store에서 실제 이력을 읽는다. 처리화면은 노출 문구만 사용자 언어로 교체.

**Tech Stack:** Next 14 App Router, React 18, Tailwind v4(PUDS), vitest+jsdom, localStorage.

## Global Constraints
- 기반: `feat/puds-adoption`(PUDS+인증+체인 통합).
- mock 격리: 자기답변·저장 결과는 `lib/result-store.ts` 한 곳 → 직원이 store 구현체만 서버 연동으로 교체.
- **§6 카피 불변**: 정답/대본/합격답변 류 금지. 자기답변 칸은 "AI 정답 아님, 스스로 답해보기"로 명시.
- **정직성**: 링크 복사는 실제 공유 안 됨 → 보조문구 "베타: 링크 공유는 곧".
- PUDS 토큰(brand/ink), `cn` from `@/lib/utils`, 좌측 정렬 유지.
- 내부 약어(SLA·클럭·진척%) 사용자 노출 금지.

---

### Task 1: result-store (mock, TDD)

**Files:**
- Create: `apps/web/lib/result-store.ts`, `apps/web/lib/result-store.test.ts`

**Interfaces — Produces:**
```ts
export type SavedDiagnosis = { id: string; createdAt: string; track: string; summary: string };
export function getAnswer(qid: string): string;
export function setAnswer(qid: string, text: string): void;
export function listDiagnoses(): SavedDiagnosis[];       // 최신순
export function saveDiagnosis(input: { track: string; summary: string }): SavedDiagnosis;
export function getDiagnosis(id: string): SavedDiagnosis | null;
```

- [ ] **Step 1: 테스트 먼저** — `apps/web/lib/result-store.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import * as store from './result-store';

beforeEach(() => localStorage.clear());

describe('result-store', () => {
  it('자기답변 라운드트립', () => {
    expect(store.getAnswer('q1')).toBe('');
    store.setAnswer('q1', '내 답변');
    expect(store.getAnswer('q1')).toBe('내 답변');
  });
  it('saveDiagnosis → listDiagnoses(최신순) + getDiagnosis', () => {
    const a = store.saveDiagnosis({ track: '공학계열', summary: 'A' });
    const b = store.saveDiagnosis({ track: '공학계열', summary: 'B' });
    const list = store.listDiagnoses();
    expect(list[0].id).toBe(b.id);       // 최신 먼저
    expect(list.map((d) => d.summary)).toContain('A');
    expect(store.getDiagnosis(a.id)?.summary).toBe('A');
    expect(store.getDiagnosis('nope')).toBeNull();
  });
  it('id·createdAt 자동 생성', () => {
    const d = store.saveDiagnosis({ track: 'x', summary: 'y' });
    expect(d.id).toMatch(/^dx_/);
    expect(Number.isNaN(Date.parse(d.createdAt))).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인** — `pnpm --filter @pullim/web test` → FAIL(모듈 없음).

- [ ] **Step 3: 구현** — `apps/web/lib/result-store.ts`:
```ts
// 학생 자기답변 + 저장된 진단 결과 — mock(localStorage). 단일 교체 지점.
// employee 후속: 이 파일을 서버 연동 구현으로 교체(인터페이스 유지).
export type SavedDiagnosis = { id: string; createdAt: string; track: string; summary: string };

const ANSWERS_KEY = 'puds-self-answers';   // qid -> text
const SAVED_KEY = 'puds-saved-diagnoses';  // SavedDiagnosis[]

function readJSON<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; }
  catch { return fallback; }
}

export function getAnswer(qid: string): string {
  return readJSON<Record<string, string>>(ANSWERS_KEY, {})[qid] ?? '';
}
export function setAnswer(qid: string, text: string): void {
  const m = readJSON<Record<string, string>>(ANSWERS_KEY, {});
  m[qid] = text;
  localStorage.setItem(ANSWERS_KEY, JSON.stringify(m));
}
export function listDiagnoses(): SavedDiagnosis[] {
  return readJSON<SavedDiagnosis[]>(SAVED_KEY, []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function saveDiagnosis(input: { track: string; summary: string }): SavedDiagnosis {
  const list = readJSON<SavedDiagnosis[]>(SAVED_KEY, []);
  const d: SavedDiagnosis = {
    id: `dx_${list.length + 1}_${Date.now()}`,
    createdAt: new Date().toISOString(),
    track: input.track,
    summary: input.summary,
  };
  list.push(d);
  localStorage.setItem(SAVED_KEY, JSON.stringify(list));
  return d;
}
export function getDiagnosis(id: string): SavedDiagnosis | null {
  return readJSON<SavedDiagnosis[]>(SAVED_KEY, []).find((d) => d.id === id) ?? null;
}
```

- [ ] **Step 4: 통과 + 커밋** — `pnpm --filter @pullim/web test` (기존 11 + 신규 3 = 14 pass).
```bash
git add apps/web/lib/result-store.ts apps/web/lib/result-store.test.ts
git commit -m "feat(web): result-store(자기답변·저장 결과 mock, localStorage)"
```

---

### Task 2: 면접 자기답변 칸 (#27)

**Files:**
- Create: `apps/web/components/result/self-answer.tsx`
- Modify: `apps/web/app/result/page.tsx` (InterviewPanel 질문 카드에 삽입)

**Interfaces — Consumes:** `getAnswer`, `setAnswer` (Task 1).

- [ ] **Step 1: SelfAnswer 컴포넌트** — `apps/web/components/result/self-answer.tsx`:
```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { getAnswer, setAnswer } from '@/lib/result-store';

export function SelfAnswer({ qid }: { qid: string }) {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => { setValue(getAnswer(qid)); }, [qid]);
  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setValue(v); setSaved(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setAnswer(qid, v); setSaved(true); }, 600);
  }
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
        내 답변 써보기
      </dt>
      <p className="mt-1 text-xs text-ink-500">
        AI 정답이 아니라, 답변 방향을 참고해 <strong className="text-ink-700">스스로</strong> 답해보는 칸이에요.
      </p>
      <textarea
        value={value}
        onChange={onChange}
        rows={4}
        placeholder="예: 활동 → 배운 점 → 진로 연결 순으로 내 말로 적어보기"
        className="mt-2 w-full resize-y rounded-xl border border-ink-100 bg-white px-4 py-2.5 text-sm text-ink-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
      <p className="mt-1 h-4 text-xs text-emerald-600" aria-live="polite">
        {saved ? '저장됨 ✓' : ''}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: 결과 카드에 삽입** — `apps/web/app/result/page.tsx` InterviewPanel: import `SelfAnswer`, 각 질문 `<dl>` 안에서 "꼬리질문 대비" `<div>` **다음에** 추가:
```tsx
            <SelfAnswer qid={`interview-${idx}`} />
```
(`q.followUp`을 보여주는 div 닫힌 직후, `</dl>` 직전.)

- [ ] **Step 3: 빌드+수동+커밋** — 빌드 통과; 답변 입력→600ms 후 "저장됨 ✓"→새로고침 유지 확인.
```bash
git add apps/web/components/result/self-answer.tsx apps/web/app/result/page.tsx
git commit -m "feat(web): 면접 질문별 자기답변 칸(자동저장, §6 명시) (#27)"
```

---

### Task 3: 처리화면 사용자 문구 (#26)

**Files:** Modify `apps/web/app/processing/page.tsx`

- [ ] **Step 1: SLA 줄 교체** — `24h SLA · 남은 시간 ...분` 단락을 교체:
```tsx
        <p className="text-xs text-ink-500">
          보통 몇 분 안에 1차 결과가 나와요. 늦어도 24시간 안에 끝나고, 완료되면 알려드릴게요.
        </p>
```
(기존 `{String(remainingH)...}` 표현 제거 — `remainingH/remainingM` 계산이 다른 곳에서 안 쓰이면 함께 제거해 lint 경고 방지.)

- [ ] **Step 2: 진척 줄 교체** — `진척 {pct}% · 클럭 시작 = 동의 완료 시점, 클럭 종료 = 결과 노출` 단락을 현재 단계 사용자 설명으로:
```tsx
      <p className="mt-2 text-xs text-ink-500">
        지금은 “{labelFor(state)}” 단계예요. 끝나면 결과 화면이 자동으로 열려요.
      </p>
```
(progressbar 시각화·4단계 파이프라인은 유지. `pct`는 progressbar에 여전히 쓰이면 유지.)

- [ ] **Step 3: §6 회귀 + 빌드 + 커밋** — `grep -nE "SLA|클럭|진척" apps/web/app/processing/page.tsx`(주석 제외 사용자 노출 0). 빌드 통과.
```bash
git add apps/web/app/processing/page.tsx
git commit -m "fix(web): 처리화면 개발자 문구→사용자 문구+기대치 (#26)"
```

---

### Task 4: 결과 저장/공유 액션 + print CSS

**Files:**
- Create: `apps/web/components/result/result-actions.tsx`
- Modify: `apps/web/app/result/page.tsx`(footer), `apps/web/app/globals.css`(print)

**Interfaces — Consumes:** `saveDiagnosis` (Task 1). Props: `{ track: string; summary: string }`.

- [ ] **Step 1: ResultActions** — `apps/web/components/result/result-actions.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { saveDiagnosis } from '@/lib/result-store';

export function ResultActions({ track, summary }: { track: string; summary: string }) {
  const [toast, setToast] = useState('');
  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 2000); }
  return (
    <div data-no-print className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => window.print()}
        className="rounded-xl border border-ink-100 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 hover:border-brand-200 hover:text-brand-700">
        PDF로 저장
      </button>
      <button type="button" onClick={() => { saveDiagnosis({ track, summary }); flash('내 결과에 저장했어요 ✓'); }}
        className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
        내 결과 저장
      </button>
      <button type="button"
        onClick={() => { void navigator.clipboard?.writeText(window.location.href); flash('링크를 복사했어요'); }}
        className="rounded-xl border border-ink-100 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 hover:border-brand-200 hover:text-brand-700">
        링크 복사
      </button>
      <span className="text-xs text-ink-400">베타: 링크 공유는 곧</span>
      <span aria-live="polite" className="text-xs font-medium text-emerald-600">{toast}</span>
    </div>
  );
}
```

- [ ] **Step 2: footer에 연결** — `result/page.tsx`: import `ResultActions`; 하단 `<div className="mt-10 ... border-t ...">` 위(또는 `학부모 리포트 보기` 옆)에 추가. `track`은 `profile ? formatStandingLabel(profile) : '공학계열'`, `summary`는 `'면접 준비 팩 · 진단 가이드 · 보완안'` 같은 한 줄. (헤더 프로필 값 재사용.)

- [ ] **Step 3: print CSS** — `apps/web/app/globals.css` 끝에 추가:
```css
@media print {
  aside, header.sticky, nav[aria-label="모바일 탭 메뉴"], [data-no-print] { display: none !important; }
  main { padding: 0 !important; }
  article, section { break-inside: avoid; }
  body { background: #fff !important; }
}
```

- [ ] **Step 4: 빌드+수동+커밋** — 빌드 통과; "내 결과 저장" 토스트, "PDF로 저장" 인쇄 미리보기에서 사이드바·탭·버튼 숨김 확인, "링크 복사" 토스트.
```bash
git add apps/web/components/result/result-actions.tsx apps/web/app/result/page.tsx apps/web/app/globals.css
git commit -m "feat(web): 결과 저장/공유(PDF 인쇄·내 결과 저장·링크 복사) + print CSS"
```

---

### Task 5: 마이페이지 이력 = result-store(실제 저장분)

**Files:** Modify `apps/web/app/mypage/page.tsx`

**Interfaces — Consumes:** `listDiagnoses`, `SavedDiagnosis` (Task 1).

- [ ] **Step 1: 소스 교체** — `mypage/page.tsx`:
  - import를 `auth`의 `listDiagnoses/DiagnosisSummary` 대신 `import { listDiagnoses, type SavedDiagnosis } from '@/lib/result-store';`로(프로필·로그아웃·탈퇴용 `useAuth`는 유지).
  - 이력 로드부(`auth.listDiagnoses().then(...)`)를 동기 호출로:
```tsx
  const [diagnoses, setDiagnoses] = useState<SavedDiagnosis[]>([]);
  useEffect(() => { setDiagnoses(listDiagnoses()); }, []);
```
  - `diagLoading` 사용처가 있으면 제거(동기라 불필요) 또는 false 고정. EmptyState/`다시 보기`(→`/result`) 렌더는 유지.
  - 빈 목록이면 EmptyState("아직 저장한 결과가 없어요" + 생기부 제출 링크) — 문구만 저장 맥락에 맞게.

- [ ] **Step 2: 빌드+수동+커밋** — 결과 페이지에서 "내 결과 저장" 후 마이페이지에 실제로 항목 등장 + "다시 보기"→/result 확인. 저장 전이면 EmptyState.
```bash
git add apps/web/app/mypage/page.tsx
git commit -m "feat(web): 마이페이지 이력을 result-store(실제 저장분)로 연결"
```

---

## Self-Review
- **Spec coverage:** #27 자기답변(T2·spec§3) · #26 처리문구(T3·§4) · 저장/공유 PDF·이력·링크(T4·§5) · result-store mock(T1·§6) · 마이페이지 실제 이력(T5·§5·§6) · §6 자기답변 카피(T2) · 정직 링크문구(T4) · print CSS(T4·§7) · vitest(T1·§8). ✓
- **Placeholder scan:** 코드 블록 모두 실제 구현 제공. T2/T4/T5 삽입 위치는 정확한 앵커(꼬리질문 div 다음·footer·useEffect) 명시.
- **Type consistency:** `SavedDiagnosis{id,createdAt,track,summary}`가 T1 정의 ↔ T4 saveDiagnosis ↔ T5 listDiagnoses 일치. `getAnswer/setAnswer(qid)` T1↔T2 일치. mypage가 auth.DiagnosisSummary→result-store.SavedDiagnosis로 전환(동일 shape).
- **리스크(spec§10):** auth.listDiagnoses는 서버 히스토리용으로 남기고 마이페이지는 result-store 단일 소스(T5). 링크 정직 문구(T4). print 전용 규칙(T4).
