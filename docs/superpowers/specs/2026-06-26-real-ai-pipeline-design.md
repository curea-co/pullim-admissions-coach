# 설계 — 실 AI 진단 파이프라인 (#16 풀 포팅, 릴리즈 P0-A)

- 일자: 2026-06-26
- 대상: `apps/web` + `packages/engine`(신규/이관) — main 위
- 목적: mock 결과를 **진짜 LLM 진단**으로 교체. 릴리즈 차단 #1 해소.
- 상태: 접근(풀 포팅)·범위 확정 → 스펙 검토 대기

---

## 1. 배경 / 목표
현재 결과는 `parkJunho` mock 고정. `feat/revamp-closed-loop`(#16)에 **검증된 실 파이프라인**이 있다: `analyze.ts`(오케스트레이터) → 마스킹→코호트→**진단(LLM)→처방(LLM)→루브릭(엔진)→면접팩(LLM)**(+로드맵·적합도·종단 트윈), opus-4-8, `server-only`. 이를 apps/web으로 풀 포팅해 **학생 입력→진짜 결과**를 만든다.

**목표:** Next 서버 라우트 `/api/analyze`에서 실제 진단 생성 · 서버측 PII 마스킹 + §6.2 합법성 게이트 가동 · 결과 3탭(면접·진단·보완) + 로드맵·적합도 실데이터.
**비목표(다른 P0):** DB 영속(C) · 실 인증(B) · 24h 잡큐 · 결제. (결과는 현재 sessionStorage 경유.)

## 2. 결정 사항 (확정)
| 항목 | 결정 |
|---|---|
| 접근 | #16 **풀 포팅**(3탭+로드맵+적합도+트윈) |
| 실행 | apps/web **Next 서버 라우트**(`server-only`, 키 env) |
| 처리 모델 | **동기 ~1분 로딩**(가짜 24h SLA 폐기) |
| 엔진 | `packages/engine`로 이관, cohort/legality **단일화(de-dup)** |
| 키 | `ANTHROPIC_API_KEY`(서버 전용, NEXT_PUBLIC 아님). **#18 회전본 필요** |

## 3. 아키텍처
- **`packages/engine`(신규)** — #16 엔진 모듈 이관: `criteria · evidence · rubric · roadmap · twin · types`. **cohort/legality 중복 제거**: 이미 `packages/shared`에 흡수돼 있으므로 engine은 그 두 모듈을 재사용(또는 cohort/legality를 engine으로 이관하고 shared가 재-export). 단일 소스 보장, 순환 의존 회피.
- **`apps/web/lib/ai/*`** 포팅 — `client.ts`(Anthropic, MODEL=opus-4-8) · `diagnose · prescribe · interview · twin-judge`(structured output) · `schemas.ts`(Zod 출력) · `system.ts`(§6 시스템프롬프트, 정의 v0.4 SSOT).
- **`apps/web/lib/mask.ts`** 포팅 — 서버측 PII 마스킹(LLM 호출 *전*).
- **`apps/web/lib/analyze.ts`** 포팅 — 오케스트레이터(AnalyzeResult 반환).
- **`apps/web/app/api/analyze/route.ts`** — POST, `runtime='nodejs'`, `maxDuration` 상향. 입력 검증→`analyze`→결과 JSON. 429/529→503 매핑(#16 패턴).
- **`@anthropic-ai/sdk`** apps/web 의존성 추가.

## 4. 입력 어댑터 (submit 페이로드 → #16 StudentProfile)
main의 `studentProfileSchema`(record.text·targetTrack·currentStanding.grade/semester/schoolType·targetUniversities[{name,department}]·consent)를 #16 `StudentProfile`로 매핑:
- `saengbu` ← record.text (마스킹된 본문)
- `admissionYear` ← `currentYear − (grade−1)` (cohortFromGrade와 동일 파생)
- `grade` ← grade
- `track5` ← targetTrack 매핑(humanities→humanities, science_engineering→engineering/natural, medical→natural, arts_athletics→arts_athletics, undeclared/other→social 또는 명시 기본). **매핑표를 lib에 명시.**
- `targetRegion` ← 'unknown'(입력 없음 — region은 system·세특가중에 영향 없음)
- `schoolType` ← schoolType 매핑(general→general, special_purpose→special_purpose, 자사/자율→autonomous, 검정고시→vocational 또는 적절 매핑)
- `targetUniversities` ← targetUniversities.map(u=>u.name) (string[])
- `consent` ← { sensitive:true, guardian: isMinor } (제출 동의에서)
- `priorSaengbu` ← (현재 없음 — 트윈은 prior 제출 생기면 활성, v1은 미사용)

## 5. 출력 + 결과 UI (AnalyzeResult → 화면)
`AnalyzeResult { cohort, diagnosis, rubric, twin?, roadmap?, fit?, interview? }` → 결과 페이지 렌더 교체:
- **면접 탭** ← `interview`(질문·답변 방향·근거·꼬리질문) — 기존 UI 구조 유지, 데이터 소스만 교체. **자기답변 칸(#27) 유지.**
- **진단 탭** ← `diagnosis`(3역량 관찰·강약점) — competencyLabel 매핑.
- **보완 탭** ← `rubric`(게이트 통과 처방, §6.2 합법) — 보완 활동.
- **신규: 로드맵 섹션** ← `roadmap`(코호트+학년 학종 타임라인), **적합도 섹션** ← `fit`(정성, 합격%·점수 없음 — §6).
- 헤더 코호트 배지(#24) 유지. "예시(데모)" 라벨은 **실데이터일 때 제거**(profile+실결과면 실제). 자기답변·저장/공유 유지.

## 6. 처리 흐름 + 모델
1. submit → consent → **처리 화면에서 `/api/analyze` 호출**(마스킹된 payload). 
2. 동기 호출(opus 3~4콜 ≈ 30~90초) — 처리 화면을 **실제 "분석 중(보통 1분, 최대 N분)" 로딩**으로(파이프라인 단계 진행 표시 가능). 24h SLA 가짜 문구 폐기.
3. 완료 → 결과를 sessionStorage(또는 메모리)에 두고 result로 이동, 렌더.
- **타임아웃 리스크:** 서버리스(Vercel) 함수 한도(기본 60s~300s). opus 풀 파이프라인이 초과할 수 있음 → `maxDuration` 상향 + 단계 병렬화 검토. 한도 초과 시 **잡큐(후속)** 가 정답 — 본 작업은 동기 + 명시적 타임아웃 안내.

## 7. PII · 안전
- **서버측 마스킹**: `mask.ts`가 LLM 호출 전 식별정보 제거(클라 자가점검을 서버가 강제) — 미성년 민감정보 핵심.
- **§6.2 합법성 게이트**: `prescribe` 출력에 `filterActions`(흡수됨) 적용 — 금지 영역/키워드 산출 0건 보증.
- **§6 시스템 프롬프트**: 정답/대본 금지·방향만·근거 인용. system.ts SSOT.
- 결과 **미영속**(현재): #16처럼 즉시 폐기(서버 저장은 C). 로그에 생기부 원문/PII 남기지 않음.

## 8. 에러 · 비용 · 레이트
- 429/529(과부하)→503 + 사용자 친화 메시지(#16). 기타→502/400.
- **비용**: opus 풀 파이프라인 호출당 비용↑ → 호출 최소화(트윈은 prior 있을 때만), 입력 길이 가드. 키는 당신 계정 과금.
- **남용 가드**: 인증 전이라 IP/세션 단위 간단 레이트리밋(과한 호출 차단). (실 레이트리밋은 인증/B 이후.)

## 9. 테스트
- 포팅된 engine·lib/ai 단위 테스트 동반 이관(#16에 50+9 존재). mask·legality·cohort 결정론 테스트.
- LLM 호출은 **모킹**(client 주입)으로 파이프라인 단계 테스트(실 호출은 수동 e2e).
- 수동 e2e(키 있을 때): 실제 생기부 입력→분석 중→실 3탭+로드맵+적합도, §6 위반 0, 마스킹 동작.
- typecheck + build + 기존 테스트 무회귀.

## 10. 선행조건
- **`ANTHROPIC_API_KEY`(회전본, #18)** `apps/web/.env.local`(gitignored). 없으면 코드 완성·테스트는 당신.
- 배포 시 서버리스 함수 **maxDuration/타임아웃** 설정 + 키를 호스팅 시크릿에.

## 11. 범위 밖 (다른 P0 — 후속)
결과 DB 영속·삭제(C) · 실 인증/사용자별 레이트(B) · 24h 잡큐(타임아웃 해소) · 알림 · 결제 · 법무 문구.

## 12. 리스크
- **서버리스 타임아웃** > 동기 풀 파이프라인 → 잡큐 전까지 한도 내 동작 보장 필요(단계 축소/병렬, maxDuration).
- **입력/출력 스키마 reconciliation**(track5·schoolType 매핑, AnalyzeResult→UI) — 매핑 누락 시 런타임 에러 → 매핑표 명시 + 테스트.
- **cohort/legality 중복** — 단일 소스로 de-dup(순환 의존 회피).
- **비용/남용** — 인증 전 무차별 호출 → 레이트 가드 필수.
- **키 부재** — 라이브 검증 불가(코드만). 데모는 mock 유지 토글 고려.
