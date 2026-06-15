# 6/1 CEO 평가 시연 시나리오 v0.1

> 작성일: 2026-05-31 (D-1, 출시 D-62) / 최선혜 (PM/EPO)
> 대상: `pullim-admissions-coach` 6/1 평가 (8/1 출시까지 D-62 시점 진척 보고)
> 환경: https://pullim-admissions-coach.vercel.app/ (Vercel demo, main `620e9c2` 기준)
> 검증: 2026-05-31 e2e Vercel demo 회귀 — 6 routes 200, 데모 배너·noindex 적용, §6 가드 라벨 노출 확인

---

## 0. 헤드라인 (30초 요약)

> **"5월 13일 CEO 30일 지침 → 5월 31일 라이브 시각 셸 + SSOT 9건 정렬. 8/1 출시 D-62, M2 prompt blocker 닫힘. 외부 의존(인프라) 외 내부 산출물 모두 정렬."**

## 1. 핵심 임팩트 3가지

| # | 메시지 | 증거 |
|---|---|---|
| ① | **2주 만에 정의 → 라이브 시각 셸** | 5/13 CEO 지침 → 5/14 정의 v0.1~0.2 (자소서 폐지 pivot) → 5/26 정의 v0.3 + 보안 정책 v0.1 → 5/28 Phase A 5화면 + Phase B 진입 → 5/29 Vercel demo prod 라이브 |
| ② | **Phase B 완성 + M2 prompt SSOT blocker 닫힘** | Zod 스키마(`packages/shared`)·`/submit` 검증·`/consent` 차단·`/processing` 24h SLA UX·EmptyState 컴포넌트 + 5/31 `prompt_v0.1.md` 391줄 머지(시스템 프롬프트 SSOT) |
| ③ | **정의 §6 가드레일을 코드와 문서 양쪽에 인코딩** | §6.1(개입 금지)·§6.2(대본 금지)·§6.3(미성년 데이터) — UI GuardrailLabel + Zod literal·refine + prompt v0.1 §2·§4 NG 정규식 + golden 5건 회귀 게이트 |

---

## 2. 시연 동선 (8 단계, ~6분)

| 순 | 화면 | 보여줄 핵심 | 시간 | 캡처 |
|---:|---|---|---:|---|
| 1 | **랜딩** (`/`) | 정의 §1 한 줄 + 결과 3종 카드(면접 준비·진단·보완) + **§6 가드 시각 라벨**("AI는 방향·근거만, 대본·정답 아님") + 시즌 안내 | 0:30 | `Screenshot_/desktop-01-landing.png` |
| 2 | **`/submit`** | §3 입력 5항목 폼(생기부 텍스트/PDF · 학부 5계열 · 목표 대학 3순위 · 학년·학기·학교유형 4종 · 부족 영역) + **마스킹 체크리스트** + Zod 검증 통과/실패 시연 | 0:45 | `Screenshot_/desktop-02-submit.png` |
| 3 | **`/consent`** | **차단 로직 시연.** 약관·개인정보·법정대리인 3개 모두 체크 안 하면 "다음" 버튼 비활성. 미성년 토글로 보호자 동의 가시화 (§6.3 P0 blocker) | 0:45 | `Screenshot_/desktop-03-consent.png` |
| 4 | **`/processing`** | 24h SLA 상태머신 (queued → parsing → diagnosing → completed) + 진척률 바 + 남은 시간 카운트다운 + SkeletonCard | 0:30 | `Screenshot_/desktop-04-processing.png` |
| 5 | **`/result`** | **여기가 메인.** 박준호 mock 기반 3탭 — 면접 준비 팩(질문 3 × 방향+근거+꼬리질문) / 진단 가이드(5항목 강·약점) / 보완안(3건) + 탭별 GuardrailLabel | 1:30 | `Screenshot_/desktop-05-result.png` |
| 6 | **`/parent`** | 학부모 주간 리포트 — 진행 *요약만*. "자녀 생기부 원문·결과 전문 미노출" 명시(§6.3 권한 분리) | 0:30 | `Screenshot_/desktop-06-parent.png` |
| 7 | **SSOT 문서 9건** (질문 시) | docs/ — 정의 v0.3.1 / 코딩 계획 / 아키텍처 / 보안 정책 / member DB / Vercel demo / **prompt v0.1** / golden 5건 | 0:30 | (GitHub 리포 보여주기) |
| 8 | **Phase 0 인프라 런북** (질문 시) | `infra/README.md` 14단계 + Dockerfile + GitHub Actions OIDC. **Gate keeper의 AWS Organizations + 3계정 회신 대기 중** | 0:30 | (런북 페이지) |

> **시연 팁**: 1→2→3→4→5→6 한 동선으로 *학생 흐름 전체*를 보여주면 §6 가드 3선이 자연스럽게 다 나옴. /result는 첫 탭(면접 준비 팩)만 캡처되어 있어 시연 시 직접 진단·보완 탭도 클릭. 모바일 폭(`mobile-*` 6장) 추가로 보여주면 모바일 우선 설계 인상.

---

## 3. 예상 질문 Top 5 & 답변 메모

**Q1. 8/1 출시 가능한가? D-62인데 인프라가 안 떴는데?**
A. *내부 산출물*은 모두 정렬됨 — 정의·코딩 계획·아키텍처·보안 정책·시스템 프롬프트·골드 데이터·5 시각 화면. 인프라(Phase 0)는 외부 의존(Gate keeper의 AWS Organizations + 3계정). 회신 후 1주에 staging 가동, 그 위에서 Phase C(NestJS api·Prisma) + Phase D(Anthropic 통합·골드 회귀) + Phase E(인증·결제·알림톡·KMS·미성년 동의 채널)가 M3 베타 → M4 출시로 정해진 일정대로 진행. 출시 blocker는 정의 §6.3 P0(미성년자 보호자 동의 + KMS 봉투 암호화). Phase E 가동 이후에만 실 데이터 수집 → blocker 우회 위험 0.

**Q2. AI가 §6 가드레일을 *실제로* 지키는가? 어떻게 강제?**
A. 3중 강제: (1) 시스템 프롬프트(`prompt_v0.1.md` §2)에 "절대 규칙"으로 박음, (2) 응답 JSON에 NG 정규식 스캔(§4.1~4.5, 골드 5건 패턴 통합) → 매치 시 응답 폐기·재생성·admin 알림, (3) 골드 5건 회귀 테스트가 prod 가동 전 게이트. 본 시스템은 *답변 대본* 대신 *방향+근거+꼬리질문*만 출력. 박준호 mock 결과 화면(`/result`)이 그 구조.

**Q3. AWS 인프라 진척은? Vercel은 prod인가?**
A. Vercel은 **demo only** — 데모 배너 + noindex 적용, 실 데이터 0. prod는 AWS Seoul ECS (검수자 결정 4.2). Phase 0 핸드오프 패키지(`infra/README.md` 14단계·Terraform 스켈레톤·Dockerfile·GitHub Actions OIDC)는 완성. Gate keeper의 1단계(Organizations + 3계정) 회신 후 즉시 2~14단계 적용 가능. Vercel demo는 AWS staging 가동 즉시 retire(`docs/008_..._vercel_demo_v0.1.md` §5).

**Q4. 미성년자 동의·결제는 어떻게?**
A. **미성년자 보호자 동의는 P0 출시 차단 조건**(정의 §6.3, 정책 §6, 검수자 결정 4.4). 채널 = 카카오 알림톡 + SES 메일 백업(Phase E 가동). 결제 = Toss Payments. 둘 다 Phase E. 동의 UI는 이미 `/consent`에 차단 로직으로 가시화. DB 모델은 `007_..._member_db_v0.1.md` 5 엔티티(Student·Guardian·Household·Consent·AuthCredential)로 잠금.

**Q5. pullim-writing-coach와 분리선은 명확한가?**
A. 명확. 정의 v0.3 §7 분리선: **임의의 글 = Writing Coach / 생기부(구조화 이력) = Admissions Coach**. 자소서 폐지로 *자소서 첨삭* 영역이 Writing Coach 측에 명백히 귀속됨. 시즌도 다름(Writing 통년 / Admissions 학종 8~11월). 본 평가는 admissions 트랙 진척 보고.

---

## 4. 시연 기술 준비물

- 디바이스: 데스크톱 1280px 권장(/result 3탭이 가장 잘 보임). 모바일도 별도 1대로 시연 가능.
- 백업: Vercel demo(SSG·static) → 와이파이 끊김 시에도 캐시 페이지 잔존.
- `NEXT_PUBLIC_DEMO=true` 환경변수 확인 (배너·noindex 활성).
- 데모 단계: 박준호 mock 입력값이 폼 기본값으로 박혀 있음 → 실시간 입력 없이 검증 통과 시연 가능.
- 브라우저 콘솔 닫아두기.

## 5. freeze 후 fast-follow 한계

- 5/31 18:00 이후 발견 이슈는 6/1 morning fast-follow PR로만. 변경 폭 = critical 한정.
- 시각 셸 카피 미세 조정 등 *비위협* 변경은 morning 직전까지 가능. *§6 가드 영향 변경 금지*.
- 평가 morning 1회 리허설 권고: 6 routes 클릭 + GuardrailLabel·차단 로직·SLA UX 동작 재확인.

## 6. 시연 *아닌* 것 (정직 표기)

- **실 AI 응답 없음.** 박준호 mock은 정적 데이터. Anthropic API 통합은 Phase D(M2 후반~M3).
- **회원가입·로그인 없음.** 인증은 Phase E.
- **실 PDF 업로드 없음.** "Mock 파일 첨부" 버튼만(개발용).
- **24h SLA 실 잡 큐 없음.** `/processing`은 90초 데모 사이클로 4단계 시각화만.
- **staging URL 없음.** Vercel demo만. AWS staging은 Gate keeper 회신 대기.
- **학부모 알림톡·결제 없음.** Phase E.

---

## 부록 A — Vercel demo 회귀 검증 결과 (2026-05-31)

| URL | 상태 | bytes | 가드 요소 |
|---|---:|---:|---|
| `/` | 200 | 21,883 | 데모 배너 ✓ / noindex ✓ / GuardrailLabel ✓ / "학생부 종합 전형" 카피 ✓ |
| `/submit` | 200 | 20,726 | Zod 검증 활성 / 마스킹 체크리스트 / 폼 placeholder 정상 |
| `/consent` | 200 | 14,294 | 3중 동의 차단 로직 / 미성년 토글 / Blocker 노트 |
| `/processing` | 200 | 15,296 | 24h SLA 4단계 / 진척률 바 / SkeletonCard |
| `/result` | 200 | 16,112 | 3탭(준비·진단·보완) / 탭별 GuardrailLabel / 박준호 mock 출력 |
| `/parent` | 200 | 17,484 | 진행 요약만 / 자녀 원문·결과 미노출 안내 |

**e2e 회귀: PASS** (5/31 main `620e9c2` 기준 Vercel auto-deploy 정상)

## 부록 B — 5/13~5/31 누적 산출물 (9 SSOT + 코드)

**docs/ 9 SSOT:**
- `001_..._wbs_v.3.1.md` (v0.3.2 patch, 자소서 폐지·5계열 enum)
- `002_..._definition_v.3.md` (§6 가드레일 3선, v0.3.1 patch로 5계열·4학교유형)
- `003_..._personas_v.2.md` (v0.1.2, 3 페르소나)
- `004_..._coding_plan_v0.1.md` (6 Phase, 3트랙, 8/1 출시)
- `005_..._architecture_v0.1.md` (AWS 토폴로지·sequence·Phase 활성화 매트릭스)
- `006_..._data_security_policy_v0.1.md` (4 Tier · 단계적 시행 · 9항 검증 체크리스트)
- `007_..._member_db_v0.1.md` (5 엔티티 + 5계열·4학교유형 enum)
- `008_..._vercel_demo_v0.1.md` (preview only·retire 조건)
- **`prompt_v0.1.md` (5/31 머지, 시스템 프롬프트 SSOT 391줄)**
- `student_profile_schema_v0.1.json` (JSON Schema draft 2020-12)
- `golden/case-01~05.md` (Phase D 회귀 기준 5건)

**코드:**
- `apps/web` Next.js 14 + Phase A 5화면 + Phase B 검증·차단·SLA UX + DemoBanner
- `packages/shared` Zod 스키마 (JSON Schema 1:1 동기)
- `infra/README.md` + Dockerfile + GitHub Actions OIDC + Terraform 스켈레톤

**GitHub Issue·PR:**
- Issue #1 — Phase 0 진행 트래커 (Gate keeper 대기 중)
- PR #2·#3·#4·#5 모두 머지 — PR 워크플로 + 골든 + rename + prompt v0.1

---

## 7. 변경 이력

| 버전 | 일자 | 변경 |
|---|---|---|
| v0.1 | 2026-05-31 | 초안. writing-coach `15_demo_scenario_2026-06-01_v1.md` 형식 채택. admissions 트랙 5/13~5/31 진척 + 6/1 평가용 시연 동선 8단계 + 예상 질문 5건 + Vercel demo 회귀 결과 |
