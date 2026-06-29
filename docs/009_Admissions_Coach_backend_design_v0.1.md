# 009 입시코치 백엔드 설계 v0.1 — pullim-api `admissions` 서비스 신설 제안

> 상태: **설계 제안(design-first)** · 2026-06-29 · 대상 pullim-api 팀(오너 ADR 게이트)
> 목적: 입시코치 프론트(현 mock/localStorage)를 **실 인증 + 실 영속**으로 전환하기 위해, pullim-api에
> `admissions` 도메인 서비스를 신설하는 데이터 모델·API·마이그레이션 설계를 확정한다.
> 근거 SoT: `packages/shared/src/schemas.ts`(studentProfileSchema·consentSchema), `lib/result-view.ts`(AnalyzeResult),
> `docs/007_member_db`(회원 모델), pullim-api `.claude/rules/{src-structure,db-structure}.md`.

---

## 0. 한 장 요약
- 입시(admissions)는 현재 pullim-api **8계 서비스(auth·store·studio·games·q·billing·planner·sales)에 없음** → **신규 서비스**다.
- pullim-api 규약상 신규 서비스 = **ADR(오너 결정) → 설계 4뷰 → 구현 카드(마이그레이션 CREATE SCHEMA)**. (planner=ADR-039, sales=ADR-042 선례)
- 신설 스키마 `admissions`에 **3엔티티**: `submissions`(생기부 제출) · `consents`(append-only 동의) · `diagnosis_results`(AI 진단 산출물).
- 회원/신원/보호자동의는 **auth 서비스 소유**(007) — admissions는 `user_id` **ID 참조**(cross-schema FK 금지).
- 보존정책: 생기부 원문·결과 **30일**(동의서 명시) 후 파기 — cron/TTL.

---

## 1. 배경·범위
입시코치 프론트는 Phase A로 **mock 인증(localStorage) + 세션 영속(sessionStorage)**으로 동작한다. 이를 버리고
"실제만"으로 가려면 (a) 실 인증(auth)과 (b) **입시 데이터 영속 백엔드**가 필요한데, 후자가 pullim-api에 전무하다.
본 문서는 (b)를 설계한다. (a) 실 인증은 auth 서비스(OAuth) 기존 자산을 사용하고 프론트 어댑터를 재작성한다(별도 카드).

**범위 IN**: 생기부 제출 수신·저장, 동의 기록, AI 진단 트리거·결과 저장·조회, 보존/파기, 학부모 요약 투영.
**범위 OUT(별도)**: 결제/구독(billing), 회원 가입·OAuth(auth), 프론트 어댑터 재작성.

## 2. 서비스 경계 (⚠️ ADR 선행 필요)
- `admissions`를 **9번째 서비스 경계**로 등재 — `docs/design/services/admissions/`(4뷰 SoT) + `src/admissions/`(온디맨드) + PG 스키마 `admissions`.
- **결정 필요(ADR)**: 서비스명(`admissions` vs `exam`), 별도 서비스 vs 기존 흡수(예: studio 하위) 여부. → 본 제안은 **독립 `admissions` 서비스** 권장(생애주기·entitlement `입시 패스`가 독립적).
- 의존 방향: `admissions → auth`(profile 투영·동의 거버넌스), `admissions → common/llm·common/email`. cross-schema FK 없음.

## 3. 데이터 모델 — `admissions` 스키마
엔티티는 스키마를 명시 선언(`@Entity({ schema: 'admissions', name: ... })`), id는 `text`(앱 생성 UUID), `user_id`는 auth.users.id **ID 참조**.

### 3.1 `submissions` (생기부 제출 — studentProfileSchema 미러)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | text PK | `sub_<uuid>` |
| user_id | text | auth.users.id 참조(인덱스) |
| schema_version | text | `'0.1'` |
| record_text | text | **마스킹된** 생기부 본문(T1 민감 — 저장 시 암호화 검토) |
| input_type | text | `text_paste` \| `pdf_upload` |
| masking_applied | boolean | 항상 true(가드 §6.3) |
| masked_fields | jsonb | maskedFieldEnum[] |
| target_track | text | targetTrackEnum |
| target_universities | jsonb | `[{name, department?}]` (≤3) |
| grade / semester / school_type | int / int / text | currentStanding |
| self_reported_weak_areas | text null | 선택 |
| created_at | timestamptz | |
| purge_after | timestamptz | created_at + 30d (보존정책) |

### 3.2 `consents` (append-only 동의 — 007·consentSchema)
- id, user_id, submission_id(같은 스키마 FK 가능), consent_type(`terms`·`privacy`·`guardian`), is_minor, granted(bool), channel(`web`), granted_at. **append-only**(수정·삭제 없이 이력).
- 미성년(is_minor=true) → guardian 동의 row 필수(서버 강제, 프론트 자기신고 불가 — auth.user.is_minor 권위값과 교차검증).

### 3.3 `diagnosis_results` (AI 진단 산출물 — AnalyzeResult)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | text PK | `dx_<uuid>` |
| submission_id | text | submissions.id FK(같은 스키마) |
| user_id | text | auth.users.id 참조 |
| status | text | `pending`·`done`·`failed` (24h SLA, BullMQ) |
| interview | jsonb | questions[] (방향·근거·꼬리질문) |
| diagnosis | jsonb | criteria[] (역량·강점·약점·근거) |
| improvements | jsonb | rubric items[] |
| roadmap / fit | jsonb null | 입시 로드맵 / 전형 적합도 |
| model / guardrail_version | text | 추적(§6 가드 버전) |
| created_at / purge_after | timestamptz | 30일 보존 |

> 학부모 투영: 별도 테이블 없이 `diagnosis_results`의 **요약 필드만**(역량 라벨·진행상태) 투영 API로 노출(본문 미노출, §6.3 권한분리).

## 4. API 표면 (Controller → UseCase → Service → Repository)
| 메서드·경로 | 설명 | 인가 |
|---|---|---|
| `POST /admissions/submissions` | 생기부 제출(record+track+standing) | 회원 + `입시` entitlement |
| `POST /admissions/submissions/:id/consent` | 동의 기록(append) | 본인 |
| `POST /admissions/submissions/:id/diagnose` | 진단 작업 enqueue(BullMQ, 24h SLA) | 본인 + 동의 완결 |
| `GET /admissions/results/:id` | 진단 결과 조회(학생 전용 본문) | 본인 |
| `GET /admissions/results` | 내 진단 이력 | 본인 |
| `GET /admissions/parent/summary` | 학부모 요약 투영(본문 미노출) | 보호자 권한(가구 모델) |
| `DELETE /admissions/submissions/:id` | 즉시 파기(동의서상 권리) | 본인 |

- LLM 호출은 **common/llm 포트** 사용. §6 가드레일 린트(packages/shared `lintGuardrails`)를 **서버에서도** 통과 강제.
- CORS·쿠키·CSRF는 auth/main.ts 공통 정책 사용(`*.pullim.ai` + credentials).

## 5. 마이그레이션·보존
- 구현 카드의 **첫 마이그레이션**이 `CREATE SCHEMA IF NOT EXISTS admissions` + 3테이블(`scripts/migration.sh generate`).
- 보존: `purge_after` 경과 row를 **cron worker**가 파기(생기부 원문·결과). 학생 요청 즉시삭제 API 동기 수행.
- ⚠️ 마이그레이션 실행·검증은 **로컬 DB(pnpm db:up) + AWS Secrets Manager 자격** 필요(현재 미확보 — 선행).

## 6. 인증·인가
- 신원·OAuth·refresh·보호자동의 코어는 **auth 소유**(007). admissions는 `JwtVerifyGuard`+`EntitlementGuard`(common/verify)로 보호.
- `입시` 접근 플래그(entitlement-flags constants에 이미 존재) + `입시 패스` 티어 매트릭스(가격정책 v1.4 §5.2).

## 7. 프론트 전환 (mock → real, 별도 카드)
- `NEXT_PUBLIC_AUTH_BACKEND=pullim` + 어댑터를 **OAuth 기준 재작성**(현 email/pw 스켈레톤 폐기).
- submit/result/parent의 sessionStorage·localStorage·parkJunho를 **admissions API 호출로 교체**. mock-adapter·result-store(local)·parkJunho 제거.
- 이 전환 시 #51/#52에서 보류한 mock-스코핑 이슈는 **소멸**(서버 per-user 영속).

## 8. 열린 결정 (ADR 착수 전 오너 결정)
1. 서비스명 `admissions` vs `exam` / 독립 서비스 vs studio 흡수.
2. 생기부 원문 저장 암호화 수준(T1) + 보존 30일 확정.
3. 가구(보호자↔자녀) 모델을 auth(007 Household) 사용 vs admissions 자체.
4. 진단 워커 인프라(BullMQ + Redis) 위치(common vs admissions).

## 9. 단계 계획
1. **ADR + 4뷰 설계**(본 문서 → pullim-api `docs/design/services/admissions/`) — 오너 승인.
2. 모듈 스캐폴드 + 엔티티 + 첫 마이그레이션(스키마 생성).
3. 제출·동의·결과 API + 워커(진단) + 가드 린트.
4. 프론트 어댑터(OAuth) + API 연동, mock 제거.
5. 보존 cron + 학부모 투영 + 즉시삭제.
