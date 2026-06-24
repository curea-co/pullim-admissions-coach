# PUDS 적용 — Phase 1 (토대) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **⚠️ 실행 전제:** 이 플랜은 PR 체인(#29/#31/#32/#33/#30)이 **`main`에 머지된 후** clean main에서 분기해 실행한다. 또한 본 문서는 **Phase 1(토대)만** 상세화한다. Phase 2(프리미티브 교체)·Phase 3(페이지 reskin)은 P1 머지 후, 병합된 실제 파일 상태와 실제 `@puds` 컴포넌트 API를 보고 각자 별도 플랜으로 작성한다(끝의 §Phases 2–3 참조).

**Goal:** `apps/web`를 Tailwind v4 + PUDS 레지스트리 + `theme-puds`(pullim-os)로 전환하되, `brand`/`ink` 호환 shim으로 기존 화면이 그대로 빌드·렌더되게 하는 토대를 깐다.

**Architecture:** Strangler 패턴 — 툴체인(v4)·레지스트리·테마를 먼저 깔고, 기존 임의 토큰(`brand`/`ink`)을 v4 `@theme` shim으로 잠시 유지해 무중단. 컴포넌트/페이지의 실제 @puds 전환은 Phase 2·3.

**Tech Stack:** Next 14.2 / React 18.3(유지), Tailwind **v4**, `@tailwindcss/postcss`, shadcn 레지스트리(`@puds`), PUDS theme `pullim-os`.

## Global Constraints

- **테마:** `pullim-os`. `<html data-theme="pullim-os">`.
- **프레임워크 불변:** React 18.3 / Next 14.2 유지(19/15 점프 금지 — 본 작업 범위 밖).
- **무중단:** Phase 1 종료 시 `next build` 통과 + 6 페이지(landing·submit·consent·processing·result·parent)가 깨지지 않고 렌더. 이를 위해 `brand`/`ink` 토큰을 v4 `@theme`에 **현재 hex 값 그대로** 재선언(호환 shim) — Phase 3 마지막에 제거.
- **§6 카피 불변:** 어떤 단계도 사용자 문구를 바꾸지 않는다(툴체인/토큰만).
- **레지스트리:** `https://pullim-design-system.vercel.app/r/{name}.json` (네임스페이스 `@puds`, shadcn v3+).
- 런타임: node>=20.11, pnpm 9.7.0.

## File Structure

| 파일 | 책임 | 태스크 |
|---|---|---|
| (검증) main 상태·레지스트리 접근 | 전제 확인 | 1 |
| `apps/web/package.json` | tailwind v4·@tailwindcss/postcss·tailwind-merge v3 | 2 |
| `apps/web/postcss.config.mjs` | v4 PostCSS 플러그인 | 2 |
| `apps/web/components.json` (생성) | `@puds` 레지스트리 등록 | 3 |
| `apps/web/app/tokens/*` (생성, shadcn add) | PUDS 토큰 CSS | 3 |
| `apps/web/app/globals.css` | `@import "tailwindcss"` + 토큰 import + brand/ink shim | 3 |
| `apps/web/tailwind.config.ts` | 제거(v4 CSS-first) | 3 |
| `apps/web/app/layout.tsx` | `data-theme="pullim-os"` | 4 |

---

### Task 1: 전제 검증 (체인 머지 + 레지스트리)

**Files:** (없음 — 검증·게이트)

- [ ] **Step 1: main이 체인을 포함하는지 확인**

Run:
```bash
git log --oneline -20 | grep -E "#19|#20|#22|#25|#17" || echo "MISSING"
```
Expected: #19/#20/#22/#25/#17 머지 커밋이 보인다. `MISSING`이면 **중단** — 체인 미머지 상태에서 reskin 금지(설계 §11 전제).

- [ ] **Step 2: PUDS 레지스트리 접근 확인**

Run:
```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://pullim-design-system.vercel.app/r/button.json
```
Expected: `200`. 아니면 **중단** — PUDS 레지스트리 배포가 선결(스킬: PUDS 레포에서 `registry:build` + Vercel 배포). 200 확인 후 진행.

- [ ] **Step 3: 베이스 브랜치**

Run:
```bash
git checkout main && git pull && git checkout -b feat/puds-phase1-toolchain
```

---

### Task 2: Tailwind v4 + PostCSS + deps

**Files:**
- Modify: `apps/web/package.json`, `apps/web/postcss.config.mjs`

- [ ] **Step 1: package.json 의존성 전환**

`apps/web/package.json`에서:
- `dependencies`: `"tailwind-merge": "^2.5.4"` → `"^3.0.0"` (PUDS 정합).
- `devDependencies`: `"tailwindcss": "3.4.13"` → `"^4.0.0"`; `"autoprefixer": "10.4.20"` 제거(v4 내장); 추가 `"@tailwindcss/postcss": "^4.0.0"`.
(react/react-dom/next는 변경 금지.)

- [ ] **Step 2: postcss.config.mjs를 v4로**

`apps/web/postcss.config.mjs`를 다음으로 교체:
```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

- [ ] **Step 3: 설치**

Run: `pnpm install`
Expected: lockfile 갱신, tailwindcss 4.x / @tailwindcss/postcss 설치.

- [ ] **Step 4: 커밋**

```bash
git add apps/web/package.json apps/web/postcss.config.mjs pnpm-lock.yaml
git commit -m "build(web): Tailwind v4 + @tailwindcss/postcss 전환 (PUDS Phase 1)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 레지스트리 등록 + theme-puds + globals(+호환 shim)

**Files:**
- Create: `apps/web/components.json`, `apps/web/app/tokens/*`(shadcn add 산출)
- Modify: `apps/web/app/globals.css`
- Delete: `apps/web/tailwind.config.ts`

- [ ] **Step 1: components.json 생성(@puds 레지스트리)**

Create `apps/web/components.json`:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "tailwind": {
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "rsc": true,
  "tsx": true,
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "utils": "@/lib/utils"
  },
  "registries": {
    "@puds": "https://pullim-design-system.vercel.app/r/{name}.json"
  }
}
```

- [ ] **Step 2: 토큰/테마 설치**

Run (from `apps/web`):
```bash
npx shadcn@latest add @puds/theme-puds
```
Expected: `app/tokens/_base.css`·`pullim-os.css`·`pullim-jr.css`(또는 동등) 복사. 실제 파일명이 다르면 산출된 경로를 다음 스텝 import에 맞춘다.

- [ ] **Step 3: globals.css 교체(+brand/ink 호환 shim)**

`apps/web/app/globals.css`를 다음으로 교체(토큰 import 경로는 Step 2 산출에 맞춤):
```css
@import "tailwindcss";

/* PUDS 토큰 + 테마 */
@import "./tokens/_base.css";
@import "./tokens/pullim-os.css";
@import "./tokens/pullim-jr.css";

/* Phase 1 호환 shim — 기존 brand/ink 클래스가 v4에서 동작하도록 현재 값 그대로 유지.
   Phase 3 마지막 태스크에서 모든 사용처를 PUDS semantic으로 옮긴 뒤 제거한다. */
@theme {
  --color-brand-50: #eef4ff;
  --color-brand-100: #dbe6ff;
  --color-brand-200: #bfd2ff;
  --color-brand-300: #93b3ff;
  --color-brand-400: #6189ff;
  --color-brand-500: #3b6bf3;
  --color-brand-600: #2954dd;
  --color-brand-700: #2143b6;
  --color-brand-800: #1f3a91;
  --color-brand-900: #1d3673;
  --color-ink-900: #0b0d12;
  --color-ink-700: #2b2f3a;
  --color-ink-500: #5b6273;
  --color-ink-300: #a0a6b4;
  --color-ink-100: #e7e9ee;
}

@layer base {
  html { -webkit-text-size-adjust: 100%; }
  body { font-feature-settings: 'ss06'; }
  ::selection { background-color: var(--color-brand-100); color: var(--color-brand-900); }
}
```
> 비고: v4는 `@theme`의 `--color-*`를 유틸(`bg-brand-600` 등)로 노출하므로 기존 클래스가 그대로 산다. body의 `bg-white`/`font-sans`/`text-ink-900`는 PUDS 테마 base가 제공(없으면 `@layer base body`에 추가).

- [ ] **Step 4: tailwind.config.ts 제거**

Run: `git rm apps/web/tailwind.config.ts`
(v4는 CSS-first; content 자동 감지. 만약 빌드가 config를 요구하면 최소 `@config`로 대체하되 우선 제거 시도.)

- [ ] **Step 5: 빌드 + 전 페이지 시각 게이트**

Run: `pnpm --filter @pullim/web typecheck && pnpm --filter @pullim/web build`
Expected: 무에러, 빌드 성공.
Run: `pnpm --filter @pullim/web dev` → `/`, `/submit`, `/consent`, `/processing`, `/result`, `/parent` 육안 확인: 레이아웃·색이 깨지지 않고(브랜드/잉크 shim 덕분) 렌더, `data-theme` 미설정 상태라 아직 pullim-os 적용 전이어도 무방.

- [ ] **Step 6: 커밋**

```bash
git add apps/web/components.json apps/web/app/globals.css apps/web/app/tokens
git rm --cached apps/web/tailwind.config.ts 2>/dev/null; git add -A apps/web/tailwind.config.ts 2>/dev/null
git add -A apps/web
git commit -m "feat(web): @puds 레지스트리 + theme-puds 토큰 + brand/ink 호환 shim (PUDS Phase 1)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: data-theme=pullim-os 적용

**Files:**
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: html에 테마 지정**

`apps/web/app/layout.tsx`의 `<html lang="ko">`를 다음으로:
```tsx
    <html lang="ko" data-theme="pullim-os">
```
(Pretendard CDN link는 유지. PUDS 토큰이 폰트를 지정하면 추후 정리.)

- [ ] **Step 2: 빌드 + 시각 확인**

Run: `pnpm --filter @pullim/web typecheck && pnpm --filter @pullim/web build`
Expected: 통과.
Run: `pnpm --filter @pullim/web dev` → 6 페이지가 **pullim-os 토큰**(프로페셔널 톤)으로 렌더되는지 확인. shim 덕분에 brand/ink 사용처도 동작. 기능(탭·PII·동의 등)·문구 불변 확인.

- [ ] **Step 3: §6 카피 회귀**

Run:
```bash
grep -rnE "정답|대본|합격\s*답변" apps/web/app apps/web/components | grep -vE "금지|NG|아닙니다|않습니다|없" || echo "clean"
```
Expected: 가드 위반 신규 0건(기존 가드 설명 문구 제외).

- [ ] **Step 4: 커밋**

```bash
git add apps/web/app/layout.tsx
git commit -m "feat(web): data-theme=pullim-os 적용 (PUDS Phase 1)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (Phase 1)

- **Spec coverage(§4·§5·§8 P1):** 툴체인 v4(Task2)·레지스트리+theme(Task3)·data-theme(Task4)·무중단 shim(Task3) ✓ · 전제 검증(Task1) ✓.
- **Placeholder scan:** Task 3 Step 2의 토큰 파일명은 `shadcn add` 실제 산출에 맞추라고 명시(레지스트리 산출물은 실행 시 확정) — placeholder가 아니라 산출-의존 경로.
- **Type/일관성:** `data-theme="pullim-os"`, `@puds` 레지스트리 URL, brand/ink hex가 현 tailwind.config 값과 일치.
- **리스크:** v4 빌드 파손 → Task3/4 빌드 게이트. 레지스트리 미배포 → Task1 게이트 중단. shim은 Phase 3 마지막에 제거.

---

## Phases 2–3 (개요 — P1 머지 후 각자 별도 플랜)

> 아래는 로드맵. 상세 플랜은 **P1 머지 + 실제 @puds 컴포넌트 API 확인 후** 작성한다(병합된 페이지 내용 의존).

**Phase 2 — 프리미티브 교체 (별도 PR):**
- `npx shadcn add @puds/button card tabs input select radio-group checkbox label badge alert empty-state skeleton progress separator` → `apps/web/components/ui/*`.
- 공용 컴포넌트 교체(파일별 1 태스크): `page-header`→`@puds/page-header|section-head`, `step-indicator`→`section-head`+`progress`, `guardrail-label`/`error-state`→`@puds/alert`(문구 불변), `empty-state`/`loading-skeleton`→`@puds/empty-state|skeleton`, `demo-banner`→`@puds/alert`.
- 완료 기준: 빌드 + 공용 컴포넌트가 @puds 기반, 기능·문구 불변.

**Phase 3 — 페이지 reskin (별도 PR, 페이지당 태스크):**
- `landing`(hero/feature-grid/footer 블록 활용), `submit`(form 프리미티브 + PII 스캔 패널 보존), `consent`(체크박스/alert 게이트 보존), `processing`(progress/skeleton + SLA 상태머신 보존), `result`(tabs + 진단 3역량 카드/면접 유형 배지/보완안 보존 + 헤더 sessionStorage), `parent`(card/section-head + 권한 분리 카피 보존).
- 마지막 태스크: globals의 **brand/ink 호환 shim 제거** + 잔존 `brand-*`/`ink-*` 클래스 0건 grep 게이트.
- 완료 기준: 페이지별 빌드+수동, **모든 기능·§6 문구 불변**, shim 제거 후에도 빌드 통과.
