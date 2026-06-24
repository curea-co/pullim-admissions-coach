# 설계 — PUDS 디자인 시스템 전면 적용 (apps/web reskin)

- 일자: 2026-06-24
- 작성: 브레인스토밍 세션 (Claude Code)
- 대상: `apps/web` (입시 코치 프론트엔드) 전체
- **실행 시점: 머지 대기 중인 PR 체인(#29/#31/#32/#33/#30)이 `main`에 머지된 후 깨끗한 main에서.** 본 설계·플랜은 지금 작성.
- 상태: 설계 확정 대기

---

## 1. 배경 / 문제

`apps/web`는 임의(ad-hoc) Tailwind v3 토큰(`brand` 파랑 스케일 + `ink` 회색 스케일, Pretendard)과 손수 만든 컴포넌트(앵커 버튼·div 카드·자체 탭/입력)를 쓴다. 별도 레포 **`pullim-design-system`(패키지명 `puds`, 이하 PUDS)** 이 풀림 공용 디자인 시스템으로 존재한다:
- **스택:** Tailwind **v4**(CSS-first `@theme`), React 19, Radix UI, CVA, shadcn **레지스트리** 배포(`https://pullim-design-system.vercel.app/r/{name}.json`).
- **구조:** `packages/{tokens,themes,ui,icons,hooks,utils}` + `apps/playground` + `registry.json`. 테마 2종: `pullim-os`(샤프·프로페셔널), `pullim-jr`(둥글·놀이형).
- **소비 모델(`docs/consuming.md`):** `components.json`에 `@puds` 레지스트리 등록 → `npx shadcn add @puds/theme-puds`(토큰 CSS) + `@puds/<component>` → `<html data-theme="...">`로 테마 선택.

입시 코치는 PUDS를 쓰지 않아 풀림 다른 서비스와 UI가 분리돼 있다. **PUDS를 전면 적용**해 일관된 디자인으로 통일한다.

## 2. 목표 / 비목표

**목표**
- `apps/web` 전체를 PUDS로 reskin: PUDS 토큰/테마 + `@puds/*` 컴포넌트.
- 테마 = **`pullim-os`**(프로페셔널 — 입시의 진지·안정 톤, 학부모 결제자 신뢰).
- 머지된 스택의 **모든 기능·카피를 보존**하며 표현만 교체.

**비목표 (YAGNI / 분리)**
- React **18→19** + Next **14→15** 프레임워크 점프 — 본 작업 범위 밖(§4 분리 조건). PUDS 컴포넌트는 Radix 기반이라 React 18에서 동작.
- PUDS 레포 자체 변경(새 `admissions` 테마 신설 등) — 별도 PUDS-레포 과제.
- 기능 추가·UX 재설계 — 본 작업은 *디자인 시스템 적용*만(동작·문구 불변).

## 3. 결정 사항 (브레인스토밍 확정)

| # | 결정 | 선택 |
|---|---|---|
| 적용 깊이 | 정통 전체 채택(토큰+테마+@puds 컴포넌트) | 확정 |
| 테마 | `pullim-os` | 확정 |
| 프레임워크 | React 18 / Next 14 유지(19/15 분리·후속) | 확정 |
| 실행 시점 | 설계 지금, 코딩은 체인 머지 후 clean main | 확정 |
| 구조 | 3 페이즈(토대 → 프리미티브 → 페이지) | 확정 |
| §6 카피 | 불변(정답/대본/합격답변 금지 그대로) | 확정 |

## 4. 플랫폼 마이그레이션

**필수 (불가피):**
- **Tailwind v3 → v4.** PUDS 테마 CSS가 v4 `@theme`/`@import "tailwindcss"` 기반. `apps/web` 변경: `postcss.config.mjs`→`@tailwindcss/postcss`, `globals.css`를 `@import "tailwindcss"` + 토큰 CSS import로, `tailwind.config.ts`는 v4 CSS-first로 제거/축소(content auto-detect). 임의 `brand`/`ink` 스케일 제거.
- **shadcn 레지스트리 설정:** `components.json`에 `"registries": { "@puds": "https://pullim-design-system.vercel.app/r/{name}.json" }`.
- **테마 설치/선택:** `npx shadcn add @puds/theme-puds`(토큰 `_base.css`·`pullim-os.css`·`pullim-jr.css` 복사) → `globals.css` import → `app/layout.tsx`의 `<html>`에 `data-theme="pullim-os"`.

**분리/후속 (조건부):**
- React 18→19 / Next 14→15는 본 작업에서 하지 않는다. `@puds` 컴포넌트 설치 중 **React 19 전용 API**(예: 새 `use`/form action 등)에 의존하는 컴포넌트가 발견되면 그 컴포넌트만 18-호환 패치하거나 별도 이슈로 분리. 19/15 점프는 별도 마이그레이션.

## 5. 토큰 / 테마

- 기존 `brand`/`ink` 임의 스케일 폐기. 컴포넌트는 PUDS **semantic 토큰**(예: `--background`/`--foreground`/`--primary`/`--muted`/`--border` 류, pullim-os 오버라이드)만 소비.
- `pullim-os` 테마로 전체 스킨. Pretendard는 PUDS 토큰의 폰트 설정을 따른다(현 fontFamily 설정은 테마로 이관).
- 본문 `max-w-prose` 등 레이아웃 유틸은 PUDS `stack`/`grid`/`page-header`로 대체하거나 유지.

## 6. 컴포넌트 매핑 (현재 → @puds)

| 현재 (apps/web) | @puds |
|---|---|
| 앵커/`<button>` (brand 클래스) | `button` |
| div 카드 (`rounded-2xl border …`) | `card` |
| 결과 탭(`role=tablist` 수제) | `tabs` |
| textarea·input·select | `input`·`textarea`(input 변형)·`select` |
| 라디오 카드·체크박스·라벨 | `radio-group`·`checkbox`·`label` |
| 배지(Q번호·면접유형·강점/보완·키워드) | `badge` |
| GuardrailLabel·ErrorState·BlockerNote | `alert` (문구 불변) |
| EmptyState·SkeletonCard | `empty-state`·`skeleton` |
| PageHeader·StepIndicator | `page-header`·`section-head` (+ progress) |
| 진행 progress bar | `progress` |
| PII 스캔 패널·진단 3역량 카드 등 복합 | `card`+`badge`+`alert` 조합(기능 보존) |

## 7. 기능 / §6 가드 보존

본 작업은 **표현 교체만**. 머지된 스택의 기능을 그대로 유지한다:
- #17 PII 티어드 게이트·자동 가림·스캔 패널 로직, #19 3역량 진단 카드(강점/보완·근거), #20 보완안, #22 면접 유형 배지, #25 결과 헤더 sessionStorage.
- **§6 가드레일 카피·라벨 불변**: "정답"·"대본"·"합격 답변" 류 금지 문구, 면접 "준비"/진단 "진단" 명칭, 미성년 동의 게이트 등. GuardrailLabel은 `@puds/alert`로 리스킨하되 **문구는 한 글자도 바꾸지 않는다.**
- 접근성(role/aria)은 @puds 컴포넌트가 기본 제공(Radix) — 기존 수제 탭/라디오보다 개선되되 동작 동일.

## 8. 페이즈 (각 페이즈 독립 검증)

- **P1 — 토대:** Tailwind v4 전환 + `@puds` 레지스트리 등록 + `theme-puds`(pullim-os) 설치 + `data-theme` + 토큰 매핑. **완료 기준:** `next build` 통과 + 기존 화면이 pullim-os 토큰으로 렌더(레이아웃 깨짐 없음).
- **P2 — 프리미티브:** 공용 컴포넌트(`button`·`card`·`tabs`·`input`·`select`·`radio-group`·`checkbox`·`label`·`badge`·`alert`·`empty-state`·`skeleton`·`progress`)를 `@puds`로 설치하고 `apps/web/components/*` + 공용 사용처를 교체. **완료 기준:** 빌드 통과 + 공용 컴포넌트가 @puds 기반.
- **P3 — 페이지:** `landing`·`submit`·`consent`·`processing`·`result`·`parent` 순차 reskin(page-header/section-head/stack/grid + P2 프리미티브). 페이지당 1 태스크. **완료 기준:** 페이지별 빌드+수동 확인, 기능·문구 불변.

## 9. 영향 파일 / 범위
- 설정: `apps/web/{package.json, postcss.config.mjs, globals.css, app/layout.tsx, components.json(신규), tailwind.config.ts(제거/축소)}`.
- 컴포넌트: `apps/web/components/*`(전부) + `apps/web/components/ui/*`(@puds 복사분 신규).
- 페이지: `apps/web/app/{page,submit,consent,processing,result,parent}/*`.
- 범위 밖: `apps/coach`(빈 셸), 미존재 admin, `packages/shared`(로직 — 무관).

## 10. 테스트
- 페이즈/페이지별 `pnpm --filter @pullim/web typecheck && build`.
- 수동/스크린샷 회귀: 각 페이지가 pullim-os로 렌더, **기능 동작(PII 차단·자동가림·탭·진단/보완/면접 탭·동의 게이트·결과 헤더) + §6 문구**가 그대로인지 확인. (RTL 미설치 — 도입은 별개.)
- §6 카피 회귀: 리스킨 후 금지어(정답/대본/합격답변)·명칭 위반 0건 grep.

## 11. 리스크 / 선행조건
- **선행조건:** ① 체인(#29/#31/#32/#33/#30)이 main에 머지돼 있어야 한다(본 작업의 베이스). ② PUDS 레지스트리(`pullim-design-system.vercel.app/r`)가 **배포·접근 가능**해야 `shadcn add`가 동작 — P1 첫 단계에서 확인, 미배포 시 PUDS 레포 배포가 선결.
- Tailwind v3→v4 전환은 유틸 클래스/플러그인 차이로 깨질 수 있음 → P1에서 빌드·전 페이지 시각 확인으로 게이트.
- `@puds` 컴포넌트가 React 19 전용 API에 의존하면 18에서 컴파일 실패 가능 → 발견 시 개별 18-호환 처리 또는 19/15 점프를 별도 결정.
- `pullim-os` semantic 토큰이 입시 코치의 모든 색 사용처(emerald/amber/rose 상태색 등)를 커버하지 못할 수 있음 → 부족분은 테마 변수 확장(PUDS 레포) 또는 로컬 semantic 추가로 보강.
- 큰 변경이므로 **페이즈별 별도 PR** 권장(P1/P2/P3) — 리뷰·롤백 단위 분리.
