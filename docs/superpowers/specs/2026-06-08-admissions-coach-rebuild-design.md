# 입시코치 전면 재구현 — 설계 스펙 (수직 슬라이스)

> 작성 2026-06-08 · 상태: 설계 승인됨(A안) · 다음: writing-plans
> 근거 SSOT: `docs/010_..._definition_v0.4.md`(이하 [D]), `docs/015_..._roadmap_wbs_v0.4.md`([WBS]), `docs/013_rubric_engine_spec_v0.1.md`([E]), `docs/012_policy_cohort_spec_v0.1.md`([P]), `docs/research/market_research_findings_2026-06-08.md`([R])
> AI 위임/EPO 직접: AI 위임(설계 초안) → EPO 검수

---

## 0. 목적·범위

기존 `apps/web`(바이브온 미투형 read-only 진단기)를 **그대로 두고**, 폐쇄루프 엣지를 구현한 **새 앱을 신설**한다. 이번 슬라이스의 목표는 8/1 비치헤드의 차별화 코어를 end-to-end로 작동시키는 것:

**입력(생기부+코호트) → ① 진단 → ② 코호트-인식 합법 액션 처방 → ④ 증거인용 증명(+면접 노드) → 루프 4단계 UI** , 실제 Claude 연동.

**범위 포함:** 코호트 판정 · 진단 · 루브릭 엔진(#1) · 증거인용·무학습(#2) · 루프 4단계 UI · §23 동의 게이트 · 결정적 마스킹 · 골든 회귀.
**범위 제외(코어로 이연, [WBS] §3.1 thin 경계):** 종단 diff(단일 스냅샷만) · OS 상류연동(#3) · 월 구독 결제 · 학부모 주간 자동 리포트 · 분기 사람검수 · AWS 인프라.

**불변 가드레일([D] §6):** "진단(not 설계)" · "면접 준비(not 대본)" · 처방은 §6.2 대입-반영 항목(세특·정규 창체·행특)만 · 미성년·민감정보 동의/보관/파기.

---

## 1. 아키텍처 (3레이어)

```
apps/coach/                  Next 16 + Tailwind v4 + TS (포트 3031). 기존 apps/web 불변.
  app/(loop)/page.tsx        루프 4단계 UI (진단→처방→추적→증명)
  app/(loop)/intake/         입력 폼(생기부·입학연도·계열·권역) + §23 동의 게이트
  app/api/analyze/route.ts   서버 라우트: 파이프라인 오케스트레이션 (API키 서버 전용)
  lib/ai/                    Claude 어댑터 (시스템프롬프트·캐싱·structured calls)
    client.ts  diagnose.ts  prescribe.ts  prompts/system.ts
  lib/mask.ts                결정적 PII 마스킹
packages/engine/             ★해자 #1: 순수 TS, 네트워크 0, 단위테스트 100%
  cohort.ts                  입학연도→체제(2027/28/29)+권역 판정 (결정적)
  legality.ts                §6.2 화이트리스트 게이트 (❌/⛔ 제거)
  rubric.ts                  LLM 처방 후보 → 합법 루브릭 조립
  evidence.ts                증거인용·불확실성 조립
  types.ts                   공통 타입
  golden/  *.test.ts         vitest 골든 회귀
packages/shared/             확장: student-profile zod (입학연도 필수·권역·종단 필드)
```

설계 원칙: **engine = 결정적 도메인 moat(네트워크 없음), ai = 교체 가능한 LLM 입력.** 합법성·코호트 정확도는 engine에서 골든 회귀로 증명되며 모델 교체에 무관하다.

---

## 2. 컴포넌트 계약 (무엇을/어떻게/의존)

### 2.1 `packages/engine/cohort.ts` — 코호트 판정 (결정적)
- 입력: `{ admissionYear: number, targetRegion: 'metro'|'non_metro'|'unknown' }`
- 출력: `{ system: '2027_old'|'2028_new'|'2029_new', track: 'beachhead'|'core', regionPolicy: {...} }`
- 규칙([P]/[D] §7): 입학연도→대입학년도→체제. 2027=구체제(고3,비치헤드), 2028·2029=신체제(고1·고2,코어,정성평가↑).
- 의존: 없음. 합격기준: **코호트 오분류 0건**.

### 2.2 `packages/engine/legality.ts` — 합법성 게이트 (결정적, 최후 안전망)
- 입력: LLM이 제안한 액션 후보 배열 `{ recordArea, text, evidenceRef }[]`
- 출력: §6.2 ✅(`SETUK`·`CREATIVE_REGULAR`·`BEHAVIOR`)만 통과; ❌(수상/자율동아리/외부봉사/독서/자격증/영재)·⛔(소논문/교외수상/사교육유발/기관명) **제거** + `stripped[]` 로그
- 의존: `types.ts`. 합격기준: **출력 금지항목 0건**(LLM이 제안해도 제거).

### 2.3 `packages/engine/rubric.ts` — 루브릭 조립
- 입력: 통과 액션 + 코호트 + 평가기준(3역량) 매핑
- 출력: 코호트-인식 합법 액션 루브릭(주어=학생 본인, 시점=앞으로 / §6.1)
- 의존: `cohort`, `legality`, `evidence`.

### 2.4 `packages/engine/evidence.ts` — 증거인용·불확실성
- 입력: 진단/처방 + 원문 생기부 문장 앵커
- 출력: 모든 항목에 인용(`evidenceRef`)+불확실성 표기. 단정형 합격% 금지(§6.3 톤).
- 합격기준: **처방 100% 증거인용**, 단정형 0건.

### 2.5 `apps/coach/lib/ai/*` — Claude 어댑터 (서버 전용)
- `client.ts`: `new Anthropic()`(env 키), 타입드 에러·백오프.
- `prompts/system.ts`: 한국어 도메인 시스템프롬프트([D] §6 + [P] + `docs/prompt_v0.1` 승계). 첫 블록 `cache_control:{type:'ephemeral'}`.
- `diagnose.ts`: `messages.parse()`+`zodOutputFormat(DiagnosisSchema)` → 5항목 매핑+강약점(증거인용).
- `prescribe.ts`: `messages.parse()`+`zodOutputFormat(ActionCandidatesSchema)` → 처방 후보(이후 engine 게이트 통과).
- 모델 `claude-opus-4-8` · `thinking:{type:'adaptive'}` · `effort:'high'` · `max_tokens:16000`.

### 2.6 `apps/coach/app/api/analyze/route.ts` — 오케스트레이션
파이프라인: zod 검증(입학연도·동의) → `mask` → `engine.cohort` → `ai.diagnose` → `ai.prescribe` → `engine.legality`→`engine.rubric` → `engine.evidence`(+면접 노드 if 비치헤드 시즌) → 반환. **영속화 없음**(무학습/즉시삭제 구조 보장).

### 2.7 `apps/coach/app/(loop)/*` — UI
루프 4단계 뷰(진단→처방→추적→증명). 면접은 시즌 노드(고3). intake에 입학연도 필수·§23 동의 게이트. Tailwind v4, 풀림 blue+lemon 톤.

---

## 3. 데이터 흐름

```
[intake 폼] 생기부 텍스트/PDF + 입학연도 + 계열 + 목표권역 + §23 동의
   │  (PDF는 클라이언트 pdfjs 텍스트 추출 — 기존 apps/web 패턴 재사용)
   ▼
POST /api/analyze
   1. zod 검증 (입학연도 누락/동의 미완 → 400 차단)
   2. mask() 결정적 PII 마스킹
   3. engine.cohort() → 체제·권역 (결정적)
   4. ai.diagnose() → 5항목 매핑+강약점 (증거인용, 캐시된 시스템프롬프트)
   5. ai.prescribe() → 액션 후보
   6. engine.legality() → §6.2 ✅만 → engine.rubric() 조립
   7. engine.evidence() → 인용·불확실성 + (시즌이면) 면접 노드
   8. 반환 (메모리 only, 미영속)
   ▼
[루프 4단계 UI] 진단 → 처방 → (추적: 단일 스냅샷) → 증명
```

---

## 4. 스키마 (요지, 확정은 구현 시 zod)

- `StudentProfile`(shared 확장): `admissionYear`(필수), `track5`(인문/사회/자연/공학/예체능 등 [D] §4 5계열), `targetRegion`, `schoolType`, `grade`.
- `Diagnosis`: `criteria[5]{ key, mapping, strength, weakness, evidenceRef[] }`.
- `ActionCandidate`: `{ recordArea, competency(학업/진로/공동체), text, rationale, evidenceRef }`.
- `Rubric`: `{ cohort, items: PrescribedAction[], uncertaintyNote }` — items는 ✅ 영역만.
- `RecordArea` enum: ✅`SETUK`|`CREATIVE_REGULAR`|`BEHAVIOR` / ❌·⛔는 enum 밖(게이트가 매핑 거부).

---

## 5. 에러 처리

- 입력: zod 실패 → 400 + 한국어 메시지(입학연도·동의 명시).
- LLM: `parse()` 스키마 불일치 자동 재시도; `parsed_output` null → 친절 폴백. `Anthropic.OverloadedError`/`RateLimitError` → SDK 백오프(어젯밤 워크플로가 실제 Overloaded 경험).
- 게이트: 금지항목 유출 시 제거+로그(골든이 0 유지 보증).
- 마스킹 누락 의심 시 진행 차단(보수적).

---

## 6. 테스트 전략

- `packages/engine` vitest(결정적, 네트워크 0): 코호트 매핑 · 합법성 게이트(금지항목 0) · 루브릭 조립 · 증거인용 — **LLM 출력은 fixture로 목킹**.
- 골든 회귀: `docs/golden` 5케이스 + 코호트별 이식. 합격기준: 금지항목 0 · 코호트 정확 · 처방 100% 증거인용 · 단정형 0.
- AI 어댑터: 목킹 단위테스트 + CI 밖 라이브 스모크 1건.
- typecheck/lint: 모노레포 `pnpm -r`.

---

## 7. 비범위·이연 (명시)

종단 diff(코어 C-M1) · OS #3(코어 C-M5) · 결제·구독(코어 C-M2) · 사람검수(미해결, CEO) · AWS·법무 채널([WBS] §6 외부 블로커). 본 슬라이스는 **로컬 실행 + 실제 Claude**까지.

---

## 8. 미해결(구현 중 확정)
- 시스템프롬프트 길이가 캐시 최소(4096토큰) 충족하는지 확인 → 미달 시 도메인 규칙 보강.
- 면접 노드 시즌 판정 기준(날짜 하드코딩 vs 입력) — 슬라이스에선 입력/플래그.
- `packages/shared` 기존 schemas.ts와 신규 StudentProfile 정합(중복 제거).
