# 핸드오프 — 입시코치 전면 재구현 (→ ultracode)

> 작성 2026-06-08 · 목적: 지금까지의 리서치·전략·설계·구현계획을 ultracode(멀티에이전트 클라우드)가 이어받아 **구현**하도록 토스.
> 한 줄 미션: **기존 `apps/web`(read-only 진단기)는 그대로 두고, 폐쇄루프(진단→처방→증명) 엣지를 구현한 새 앱 `apps/coach` + 결정적 해자 `packages/engine`를 만들고 실제 Claude를 연동해 end-to-end로 작동시킨다.**

---

## 0. 지금 상태 (한눈에)

- **완료:** 시장 리서치 → 전략 revamp(정의 v0.4) → 9 specs → 재구현 설계 스펙 → **12-태스크 구현 계획**. 즉 *기획·설계는 끝, 코드는 0줄.*
- **다음(ultracode가 할 일):** 아래 구현 계획을 TDD로 실행해 `packages/engine` + `apps/coach`를 빌드.
- **불변 제약:** `apps/web`·`packages/shared`(기존)·`docs/002~009`는 건드리지 말 것(shared는 `profile.ts` 추가만).

## 1. 권위 문서 (읽는 순서)

1. **구현 계획 (실행 대상):** `docs/superpowers/plans/2026-06-08-admissions-coach-rebuild.md` ← **이것을 태스크 0→12 순서로 실행**
2. **설계 스펙:** `docs/superpowers/specs/2026-06-08-admissions-coach-rebuild-design.md`
3. **전략 키스톤(SSOT):** `docs/010_Admissions_Coach_definition_v0.4.md` (특히 §6 가드레일·§7 코호트)
4. **루브릭 엔진 IP:** `docs/013_rubric_engine_spec_v0.1.md`
5. **정책·코호트:** `docs/012_policy_cohort_spec_v0.1.md`
6. **리서치 근거:** `docs/research/market_research_findings_2026-06-08.md`
7. (배경) `docs/000_REVAMP_BRIEF_for_CEO_2026-06-08.md`, `docs/REVAMP_REVIEW_2026-06-08.md`, `docs/011·014~017`

## 2. 무엇을 만드나 (3레이어)

```
packages/engine/   순수 결정적 TS, 네트워크 0 — 해자 #1. 코호트 판정·§6.2 합법성 게이트·루브릭·증거인용·골든회귀.
apps/coach/lib/ai  Claude 어댑터 — claude-opus-4-8, messages.parse + zodOutputFormat, 시스템프롬프트 캐싱.
apps/coach         Next 16 + Tailwind v4(포트 3031). 루프 4단계 UI + /api/analyze 오케스트레이션. 결과 미영속(무학습/즉시삭제).
```

## 3. ★불변 가드레일 (위반 = 실패. 골든으로 강제)

- **처방 허용 영역은 §6.2 대입-반영만:** 세특(SETUK)·정규 창체(CREATIVE_REGULAR)·행특(BEHAVIOR). **그 외(수상·자율동아리·외부봉사·독서·자격증·영재·소논문·교외수상·사교육·부모배경)는 처방·언급 금지.** `legality.ts` 게이트가 제거하고, 골든이 **금지항목 산출 0건**을 합격기준으로 강제.
- **진단(not 설계):** 교사 기재영역 문구 대필 금지. 처방 주어=학생 본인, 시점=앞으로.
- **면접 준비(not 대본):** 완성답변·"합격답변" 금지.
- **코호트 분기 필수:** 2024입학=2027 구체제, 2025=2028 신체제, 2026=2029 신체제. 골든 **코호트 오분류 0건**.
- **무학습/즉시삭제:** `/api/analyze`는 결과를 저장하지 않음(메모리 only). 생기부는 LLM 전송 전 결정적 마스킹.
- **증거인용 100%:** 모든 진단·처방은 생기부 원문 인용. 단정형 합격 보장 0건.

## 4. 실행 가이드 (멀티에이전트)

- 계획의 태스크는 **TDD 5스텝**(실패테스트→실패확인→구현→통과확인→커밋)으로 작성됨. 스텝 코드를 그대로 사용.
- **병렬화 힌트:** `packages/engine`의 cohort/legality/evidence(T2·T3·T4)는 서로 독립 → 병렬 가능. rubric(T5)·golden(T6)은 그 뒤. apps/coach(T7~T11)는 engine 완료 후.
- **검증 게이트(각 단계 후 필수):**
  - `pnpm --filter @pullim/engine test` (골든: 금지항목 0·코호트 정확·증거 100%)
  - `pnpm --filter @pullim/coach test` (마스킹·어댑터·파이프라인)
  - `pnpm --filter @pullim/coach typecheck`
- **라이브 스모크(키 필요):** `ANTHROPIC_API_KEY` 설정 후 `pnpm dev:coach` → `http://localhost:3031/intake`.

## 5. 기술 스택 핵심 사실 (claude-api 스킬 확인됨)

- 모델 `claude-opus-4-8`(최신·최강). `thinking:{type:'adaptive'}`, `output_config:{effort:'high'}`. budget_tokens·temperature는 **400 에러**(쓰지 말 것).
- 구조화 출력: `client.messages.parse({ output_config:{ format: zodOutputFormat(schema) }})`. `parsed_output` null 처리.
- 프롬프트 캐싱: 한국어 도메인 시스템프롬프트를 첫 블록 `cache_control:{type:'ephemeral'}`(최소 4096토큰), 가변(학생데이터)은 뒤로. 시스템프롬프트에 날짜/ID 보간 금지(캐시 무효화).
- 서버 전용(`'server-only'`), API키는 클라이언트 노출 금지. 에러는 `Anthropic.OverloadedError/RateLimitError` 타입드 처리(어젯밤 워크플로가 실제 Overloaded 경험 — 백오프 필요).
- pnpm 모노레포(npm 금지). Next 16은 워크스페이스 패키지 `transpilePackages` 필요.

## 6. 범위 경계 (이번 슬라이스 = 8/1 비치헤드 thin)

- **포함:** 코호트·진단·루브릭엔진(#1)·증거/무학습(#2)·루프4단계UI·§23 동의게이트·마스킹·골든회귀·실제 Claude.
- **제외(코어로 이연):** 종단 diff(단일 스냅샷만)·OS 상류연동(#3)·월 구독 결제·학부모 주간 자동리포트·분기 사람검수·AWS 인프라.

## 7. 인간(CEO) 미해결 결정 — 구현을 막진 않음, 병행 확정

가격/구독 구조 · 8/1 thin 경계 최종 · 첫 채널(B2C/학원·학교/OS번들) · 사람검수 운영 여부 · OS 통합 우선순위. (상세: `docs/REVAMP_REVIEW` D2~D15)

## 8. 주의

- `apps/web`(포트 3030)·기존 `docs/002~009`는 변경 금지(이력 보존).
- 시스템프롬프트가 캐시 최소(4096토큰) 미달이면 도메인 규칙 보강.
- `@anthropic-ai/sdk/helpers/zod` 경로가 설치 버전과 다르면 `messages.create`+zod `safeParse` 폴백(계획 T8 Step6 명시).
