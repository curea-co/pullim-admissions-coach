# Pullim Admissions Coach

> **생기부를 넣으면 학종 면접 준비·생기부 진단·부족 활동 보완안을 한 번에 받는, 고1~고3을 위한 AI 진학 코치.**

학생부종합전형(학종)을 준비하는 고등학생이 자신의 생활기록부를 올리면, AI가 면접을 준비시키고(답변 방향·근거·꼬리질문), 학종 평가 기준으로 생기부를 진단하며, 부족한 활동의 보완안을 제시하는 서비스입니다.

- **1차 사용자:** 고1~고3 학생 (수시 원서·학생부 마감 시즌 7~9월, 면접 시즌 10~11월)
- **2차 사용자(결제자):** 학부모 (주 1회 진행 리포트)
- **출시 목표:** 2026-08-01 (수능 D-110, 수시 원서·학생부 마감 시즌)

자세한 정의는 [docs/002_Admissions_Coach_definition_v.3.md](docs/002_Admissions_Coach_definition_v.3.md)를 읽으세요. **이 문서가 서비스의 단일 진실 소스(SSOT)입니다.**

---

## 핵심 산출물 3종

| # | 산출물 | 내용 | SLA |
|---:|---|---|---|
| 1 | 학종 면접 준비 팩 | 예상 질문 10종 × (답변 방향 + 근거 생기부 항목 + 꼬리질문 대비) | 접수 후 24h 내 1차본 |
| 2 | 생기부 진단 가이드 | 학종 평가 기준 5항목 매핑 + 강·약점 진단 + 본인이 앞으로 할 보완 방향 | 접수 후 24h 내 1차본 |
| 3 | 부족 활동 보완안 | 키워드 추출 + 학부 적합도 차이 + 보완 활동 3건 | 학생 즉시 / 학부모 주 1회 |

---

## ⚠️ 반드시 지켜야 할 가드레일 (정의 v0.3 §6)

이 제품은 두 개의 규제·윤리 위험선에 닿습니다. **구현·마케팅 전 단계에서 강제됩니다.**

1. **생기부 "진단"만, "개입/대필" 금지.** 생기부는 교사가 작성하는 공적 기록입니다. 제품은 이미 작성된 생기부를 *해석*하고 학생이 *앞으로 할* 활동을 제안할 뿐, 교사 기재 영역(세특·행특)의 문구를 써주거나 기존 기재분을 고치라고 지시하지 않습니다. → "설계" 표현 금지, "진단" 사용.
2. **면접 "준비"만, "대본" 금지.** 완성 답변을 암기시키지 않습니다. 학생이 자기 언어로 답하도록 코치합니다. → "합격 답변 제공" 류 카피 금지.
3. **미성년자 데이터 = 출시 차단 조건(P0).** 생기부는 미성년자 민감정보입니다. 식별정보 마스킹 기본 강제(제출 전 클라이언트 PII 자동 검출 — 전화·주민번호·이메일·학교명은 하드 차단, 이름·교사·주소·생년월일은 경고+확인), 법정대리인 동의 절차 + 보관·삭제 정책이 닫히기 전에는 출시하지 않습니다.

---

## 문서 구조 (`docs/`)

| 파일 | 내용 | 최신 버전 |
|---|---|---|
| [002_Admissions_Coach_definition_v.3.md](docs/002_Admissions_Coach_definition_v.3.md) | **서비스 정의 SSOT** | v0.3.1 (검수 확정) |
| [001_Admissions_Coach_wbs_v.3.1.md](docs/001_Admissions_Coach_wbs_v.3.1.md) | 6개월 로드맵 WBS | v0.3.2 |
| [003_Admissions_Coach_personas_v.2.md](docs/003_Admissions_Coach_personas_v.2.md) | 핵심 사용자 페르소나 3명 | v0.1.2 |
| [004_Admissions_Coach_coding_plan_v0.1.md](docs/004_Admissions_Coach_coding_plan_v0.1.md) | 6 Phase 코딩 계획 (PM) | v0.1 |
| [005_Admissions_Coach_architecture_v0.1.md](docs/005_Admissions_Coach_architecture_v0.1.md) | 시스템 아키텍처 (AWS·앱·흐름) | v0.1 |
| [006_Admissions_Coach_data_security_policy_v0.1.md](docs/006_Admissions_Coach_data_security_policy_v0.1.md) | 데이터 분류·암호화·보관 정책 (§6.3 P0 운영 사양) | v0.1 |
| [007_Admissions_Coach_member_db_v0.1.md](docs/007_Admissions_Coach_member_db_v0.1.md) | 회원·인증 DB 모델 (Gate keeper 회신용) | v0.1 |
| [008_Admissions_Coach_vercel_demo_v0.1.md](docs/008_Admissions_Coach_vercel_demo_v0.1.md) | Vercel demo 운영·retire 정책 | v0.1 |
| [009_Admissions_Coach_demo_scenario_2026-06-01_v0.1.md](docs/009_Admissions_Coach_demo_scenario_2026-06-01_v0.1.md) | 6/1 CEO 평가 시연 시나리오 (동선·Q&A·회귀) | v0.1 |
| [prompt_v0.1.md](docs/prompt_v0.1.md) | **AI 시스템 프롬프트 SSOT** (§6 가드 코드화 + NG 정규식) | v0.1 |
| [student_profile_schema_v0.1.json](docs/student_profile_schema_v0.1.json) | 학생 입력값 JSON Schema | v0.1 |
| [golden/](docs/golden/) | Phase D 회귀 기준 5 케이스 + §6 NG 셋 | v0.1 |
| [002_Admissions_Coach_definition_v.2.md](docs/002_Admissions_Coach_definition_v.2.md) | 정의 v0.2 (자소서 폐지 패치 노트, 이력용) | v0.2 |
| [002_definition_pivot_memo_v.1.md](docs/002_definition_pivot_memo_v.1.md) | 자소서 폐지 대응 방향 메모 (이력용) | v0.1 |
| [012_policy_v2_screen_and_backend_plan_v0.1.md](docs/012_policy_v2_screen_and_backend_plan_v0.1.md) | 회원플랜 v2 화면·백엔드 계획 (이용권 게이트) | v0.1 |
| [013_admissions_BE_P0_design_v0.1.md](docs/013_admissions_BE_P0_design_v0.1.md) | admissions 백엔드 P0 설계 | v0.1 |
| [016_llm_integration_trial_2026-09-18.md](docs/016_llm_integration_trial_2026-09-18.md) | **LLM 연결 1차 시험 기록** (비용 실측·PII 버그·스키마 확장) | 2026-09-19 갱신 |
| [017_openrouter_migration_plan_2026-09-18.md](docs/017_openrouter_migration_plan_2026-09-18.md) | **OpenRouter 전환 실행 기록** (골드 5건 회귀·운영 키) | 2026-09-19 갱신 |

> **읽는 순서:** definition v0.3 → personas → WBS. v0.2·pivot memo는 의사결정 이력 참고용입니다.

---

## 명칭 규칙 (전 문서 통일)

- ✅ "생기부 **진단** 가이드" / ❌ "생기부 설계 가이드"
- ✅ "면접 **준비** 팩" / ❌ "면접 답변(대본)"
- ✅ 학종 자기소개서는 **2024학년도 대입부터 폐지** — 산출물에 포함하지 않음

---

## 현재 상태 (2026-09-20)

> 이 절이 **현재 상태를 말하는 유일한 문서**다. `docs/008`·`docs/009`·`infra/README.md` 는
> 각각 어느 시점의 기록이며 상단 배너로 유효 범위를 밝혀 뒀다.

8/1 출시 목표는 지났다. 진단 파이프라인은 끝까지 동작하고, 남은 차단은 이용권 쪽이다.

**동작하는 것**

- **진단 3콜 파이프라인** — OpenRouter + `google/gemini-3.8-flash`. 되돌리기는 `ADMISSIONS_LLM_GATEWAY=anthropic`(haiku-4.5 직결). 엔진에서 `@anthropic-ai/sdk` import 가 사라졌다 (017)
- **골드 5건 전부 통과** — §6 가드레일 위반 0 · 문체 플래그 0. 5계열·4학교유형 커버. 실측 분석 1건 $0.0848 / 99초 (016 §5.5)
- **FE 실 API 배선** — `/admissions/submissions` → `/consents` → `/diagnose` → 폴링 → `/results/{id}`. mock 이 아니다
- **쿠폰 등록** — `POST /billing/coupons/redeem`. OS 결제 딥링크가 없는 동안 이용권을 얻는 **유일한 경로**이고, 실제로 벽을 연다 (#90)
- 회귀 테스트 704건 (51파일)

**막혀 있는 것**

- **`admissions` 이용권 카탈로그 등록** — OS 소관이라 이 저장소에서 못 고친다. dev 의 `/me/entitlements` flags 에 `admissions` 자리가 없어 번들로는 아무도 통과하지 못한다. 쿠폰이 그 차단을 우회한다
- **`/me` 의 `consentStatus` 노출** — 법정대리인 동의를 자기신고가 아닌 권위값으로 판정하려면 필요하다 (#91 참조). BE 작업 선행

**인프라 — 실측 (2026-09-19)**

```
계정          022038145489  (하나)
ECS 클러스터   pullim        (하나)
환경          local · dev · prod   ← staging 없음
시크릿        pullim/{local,dev,prod}/backend
앱            apps/web 하나 (api·admin 은 만들어지지 않았다)
배포          Vercel (프론트) + pullim-api (진단 백엔드)
```

3계정 분리 · `staging.pullim.curea.co` · `apps/api`·`apps/admin` 3앱 계획은 **실행되지 않았고
ADR-058 로 불필요해졌다.** 진단 백엔드가 기존 `pullim-api` 안으로 들어가면서 전용 계정이
필요 없어졌고, 입시코치는 프론트만 Vercel 에 남았다. 경위는 `infra/README.md` 배너.

**프론트:** https://pullim-admissions-coach.vercel.app/

**연령 기준 (2026-09-20 정정)**

법정대리인 동의는 **만 14세 미만**이 기준이다(개인정보 동의 경계). 이전 문서의 "만 19세 미만"은
근거 없이 굳은 오기였다 — 경위는 `apps/web/lib/consent-gate.ts` 주석과 #91. 만 14세 이상은
본인 동의로 진행하되 보호자 고지를 권한다.

## 진행 단계 (Phase)

상세는 [coding plan](docs/004_Admissions_Coach_coding_plan_v0.1.md) 참조.

| Phase | 기간 | 목표 |
|---|---|---|
| **0. 인프라 부트스트랩** | ~1주 | ~~AWS 전용 계정 3개~~ — **폐기.** ADR-058 로 `pullim-api` 에 합류, 프론트는 Vercel |
| **A. Visual Skeleton** | ~1주 | Next.js 5화면 + 박준호 mock, staging URL 시연 |
| **B. Interactive Form** | ~1주 | Zod 검증·동의 게이트·24h SLA 상태머신 |
| **C. Backend Stubs** | ~1주 | NestJS api + BullMQ — **`pullim-api` 안에서 완료**(이 레포에 `apps/api` 는 없다) |
| **D. AI 통합** | ~2주 | LLM + §6 가드레일 프롬프트 + 골드 회귀 — **완료**(OpenRouter 전환, 017) |
| **E. 운영 출시** | M3~M4 | 인증·결제·동의 채널·KMS·보관/삭제·모니터링 (8/1 출시) |

## 트랙 분담

**권고:** 3트랙 (Infra/DevOps · Backend · FE)
**차선:** 2트랙 (Platform = DevOps+Backend / Product = FE)

---

## 기여 / 운영

- 이 리포지토리는 비공개입니다. curea-co 팀원에게 write 권한이 부여되어 있습니다.
- 정의(definition)는 SSOT이므로, 정의를 바꾸면 WBS·personas·schema·카피를 §11 cascade 목록대로 동기화하세요.
- 문의: 최선혜 (Education Product Owner)
