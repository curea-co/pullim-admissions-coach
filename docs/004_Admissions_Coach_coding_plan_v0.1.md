# Coding Plan v0.1 (PM)

확정일: 2026-05-26 (화)
작성자: 최선혜 (Education Product Owner) / AI(Product Manager) 작성
승인: 검수자 결정 4.1~4.4 (2026-05-26)
연관 문서: `002_Admissions_Coach_definition_v.3.md`, `005_Admissions_Coach_architecture_v0.1.md`, `006_Admissions_Coach_data_security_policy_v0.1.md`, `001_Admissions_Coach_wbs_v.3.1.md`

> **CEO 지침:** 시각적 구현 먼저 → 스코프 단계적 확대. 본 코딩 계획은 그 원칙을 5+1 Phase로 분해하고, 회사 표준 AWS 인프라 위에서 8/1 출시까지의 실행 경로를 박는다.

---

## 1. 승인된 결정 (검수자, 2026-05-26)

| # | 결정 | 출처 |
|---:|---|---|
| 4.1 | 회사 표준 AWS 인프라 채택 (ECS + ALB + RDS Multi-AZ + Redis + S3 + WAF + Route53 + SES + ECR + GitHub Actions) | 검수자 |
| 4.2 | Phase 0(인프라 부트스트랩, ~1주)을 WBS M1 안에 명시. 시각 셸도 처음부터 ECS staging에서 시연 | 검수자 |
| 4.3 | 모노레포 3 앱(`apps/web`·`apps/api`·`apps/admin`). Admin은 EPO 검수 도구로 M3부터 본격 가동, 셸은 Phase A에 미리 | 검수자 |
| 4.4 | 데이터 분류·암호화 정책 v1 = Phase 0 산출물 (정의 §6.3 P0 blocker의 운영 사양서) | 검수자 |

---

## 2. 우선순위 조정 — Phase E 이연 항목

검수자 결정에 따라 *시각·핵심 기능*을 먼저 박고 다음 항목들은 Phase E(M3 후반~M4)로 일괄 이연:

- **결제** (Toss Payments 연동)
- **법정대리인 동의 채널** (SES + 카카오 알림톡/SMS) — 동의 *플로우 UX*는 Phase A부터 화면으로 노출, *실 발송 채널*만 이연
- **KMS 봉투 암호화** (애플리케이션 레벨 T2 강화 암호화) — Phase 0~D는 RDS·S3 기본 암호화로 충분
- **CloudWatch 대시보드·Sentry 알림 설정** — 로그 *수집*은 ECS 기본값으로 Phase 0부터 가동, *대시보드·알림 설정*만 이연

⚠️ **이연 가능 근거:** Phase 0~D 동안 실 미성년자 데이터를 수집·저장하지 않는다(합성·가명만 사용). 따라서 위 4건은 출시 직전 가동해도 컴플라이언스 위반이 없다. 자세한 단계별 시행은 `006_..._data_security_policy_v0.1.md` §4 참조.

---

## 3. 트랙 분담 — PM 검토 결과

### 3.1 검수자 제안 (DevOps / FE 2트랙) 검토

| Phase | DevOps (인프라) | Backend (NestJS 앱) | FE (Next.js 앱) |
|---|:-:|:-:|:-:|
| 0 | ★★★ | – | – |
| A | ☆(배포) | – | ★★★ |
| B | – | ☆(Zod 동기) | ★★★ |
| C | ☆ | ★★★ | ★★ |
| D | – | ★★★ | ★ |
| E | ★★ | ★★★ | ★★ |

**NestJS 애플리케이션 개발은 인프라(DevOps)와도 다르고 화면(FE)과도 다른 별개 작업량**이다. 2트랙으로 가면 Phase C 이후 백엔드 작업이 한쪽에 끼워넣어지면서 병목 발생.

### 3.2 권고

**Option 1 (권고): 3트랙**
- **Infra (DevOps) 트랙** — Phase 0 부트스트랩, Phase E 모니터링·보안·이관
- **Backend 트랙** — NestJS api 모듈·AI 통합·큐·인증·도메인 로직
- **FE 트랙** — Next.js web + admin 화면·상태·폼

**Option 2 (차선, 인력 부족 시): 2트랙**
- **Platform 트랙** — DevOps + Backend (서버사이드 전부)
- **Product 트랙** — FE (web + admin)

검수자께 결정 요청 (#1, §6).

---

## 4. Phase 구조

### Phase 0. 인프라 부트스트랩 (~1주, M1 후반과 병렬)

**트랙: Infra 단독**

- VPC·서브넷·NAT·Bastion (회사 템플릿)
- ALB + WAF + Route53 (staging·prod 분리)
- ECS 클러스터 + 3개 서비스(`web`·`api`·`admin`) 빈 셸
- RDS Postgres Multi-AZ (스키마 비어 있음)
- Redis ECS 서비스 (BullMQ 사용 전제)
- S3 2 버킷 (PDF 업로드, 결과물) — 퍼블릭 차단
- SES 도메인 인증 (curea.co)
- ECR 3 리포 + GitHub Actions 빌드/배포 매트릭스
- KMS 키 *생성만* (Phase E에서 봉투 암호화에 사용)
- 데이터 분류·암호화 정책 v1 = ✅ `006_..._data_security_policy_v0.1.md`

**종료 기준:**
- `staging.pullim.curea.co`·`api.staging...`·`admin.staging...` 헬로월드 200 응답
- DB·Redis·S3 연결 확인
- Bastion 접근 확인
- WAF 룰 적용 + 로그 수집

### Phase A. Visual Skeleton (~1주, M1 후반)

**트랙: FE 단독 (Infra는 배포 지원)**

- Next.js 14 App Router + TypeScript + Tailwind + shadcn/ui 스캐폴드
- Pretendard 한글 폰트, 디자인 토큰, 모바일 우선 반응형
- 5개 화면 정적 mock:
  1. 랜딩 LP (정의 §1 한 줄 + 가치 제안)
  2. 입력 폼 (정의 §3 5항목)
  3. 동의 게이트 (정의 §6.3, 법정대리인 항목 *화면으로 노출*)
  4. 결과 3종 탭 (면접 준비 팩·생기부 진단·활동 보완안)
  5. 학부모 리포트 화면
- 박준호 페르소나 mock 데이터 (`003_..._personas_v.2.md` 기반)
- Admin 빈 셸 (검수 큐 placeholder)
- **§6 가드레일 시각적 라벨**: 결과 화면에 "AI가 제공하는 것은 *방향*이며 대본·정답이 아닙니다" 류 가시 표시

**종료 기준:** `staging.pullim.curea.co`에서 CEO·EPO가 전체 학생/학부모 여정 클릭 시연.

### Phase B. Interactive Form + State (~1주, M2 초)

**트랙: FE 주도, Backend는 Zod 스키마 공유**

- `packages/shared/`에 Zod 스키마 (`student_profile_schema_v0.1.json`와 1:1 동기)
- 입력 폼 동작: 5항목 + 마스킹 확인 + 동의 게이트 차단 로직
- 24h SLA UX 상태머신 (접수 → 대기 → 결과 → 만료 알림)
- 폼 → mock API 호출(api 서비스가 mock 응답 반환)
- 클라이언트 라우팅·에러 상태

**종료 기준:** 잘못된 입력은 차단, 정상 입력은 결과 화면(mock)에 도달.

### Phase C. Backend Stubs (~1주, M2 중)

**트랙: Backend 주도, Infra 지원, FE 연동**

- NestJS api 모듈 구조:
  - `submission` (입력 접수·저장)
  - `consent` (동의 이벤트, append-only)
  - `result` (산출물 인덱스·조회)
  - `report` (학부모 리포트 집계)
  - `audit` (T3 로그)
- Prisma 스키마 + 마이그레이션 (RDS)
- S3 업로드 Presigned URL 발급 엔드포인트
- BullMQ 잡 큐 stub (24h SLA 단축 모드로 dev에서 빠르게 확인)
- Admin 검수 큐 조회 화면 (큐 상태·산출물 메타)
- Zod 검증을 NestJS pipe로 적용 (FE와 동일 스키마)

**종료 기준:** 폼 제출 → DB 저장 → 큐 잡 enqueue → mock 결과 비동기 노출.

### Phase D. AI 통합 (~2주, M2 후 ~ M3)

**트랙: Backend 주도 + EPO 프롬프트 검수**

- pdf-parse → 텍스트 정규화
- Anthropic SDK 통합 (Opus 4.7, prompt caching)
- 시스템 프롬프트 v1 (§6 가드레일 강제):
  - §6.1: 보완 제안 주어=학생 본인, 시점=앞으로 (교사 기재영역 문구 산출 금지)
  - §6.2: 답변 *방향*만, 완성 대본 금지
- 3종 출력 프롬프트:
  - 면접 준비 팩 (질문 10종 × 방향·근거·꼬리질문)
  - 생기부 진단 가이드 (평가기준 5항목 매핑 + 강·약점)
  - 부족 활동 보완안 (학부 적합도·제안 3건)
- 골드 데이터 5건 (가명) + 회귀 테스트
- **가드레일 위반 자동 탐지** (키워드·구조 검사) → admin 알림
- 비용·레이트 모니터링 (CloudWatch metrics)

**종료 기준:** 박준호 mock에서 실 AI 응답이 §6 위반 0건, 골드 5건 회귀 통과.

### Phase E. 운영 출시 (M3 후반 ~ M4)

**트랙: 3트랙 전원**

- 학생/학부모 회원 가입·로그인 (NestJS + Passport, JWT/세션)
- **법정대리인 동의 채널 실 발송**: SES 메일 + 카카오 알림톡/SMS
- 보호자-자녀 가구 연결, 학부모 권한 (자녀 진행 요약만)
- **Toss Payments** 결제 연동
- 보관·삭제 cron 가동 (NestJS `@Cron`)
- 학부모 주간 리포트 자동 발송 (SES)
- **KMS 봉투 암호화** 시행 (T2 데이터)
- CloudWatch 대시보드 + Sentry 알림 + 24h SLA 위반 알림
- WAF 룰 본격 강화 (`/api/auth`·`/api/submit`·`/api/consent` rate-limit)
- 사고 대응 플레이북·약관·개인정보처리방침 법무 검토 통과
- `006_..._data_security_policy_v0.1.md` §9 검증 체크리스트 9건 모두 ✅

**종료 기준 = 출시 차단 조건 해제:**
- 정의 §6.3 P0 blocker 모두 닫힘
- 8/1 수시 원서·학생부 마감 시즌 GTM 가능

---

## 5. WBS 정합

| WBS | 본 코딩 계획 |
|---|---|
| M1 (2026-05~06) | Phase 0 + Phase A → 시연 가능 셸 |
| M2 (2026-06~07) | Phase B + C + D → 알파 end-to-end |
| M3 (2026-07) | Phase D 완성 + Phase E 일부(인증·관리 도구) → 베타 30건 검수 |
| **M4 (2026-08-01 출시)** | **Phase E 완성 → 출시 blocker 닫힘** |
| M5 (2026-09~11) | 운영 + 면접 시즌 캠페인 |
| M6 (2026-11~12) | 수능 D-Day + 정시 면접/논술 캠페인 |

기존 WBS의 ⚠️ 트리아지 3건:
- PDF 파싱 → Phase D 흡수
- 결제 → Phase E (Toss)
- **미성년자 동의 → Phase E (P0 blocker, 본 계획·정책 v1로 운영 사양 닫힘)**

---

## 6. 검수자 결정 요청 (잔여)

| # | 결정 | 권고 |
|---:|---|---|
| 1 | 트랙 = 3트랙(권고) vs 2트랙(차선) | 인력 상황 확인 후 결정 |
| 2 | 보관 기간 12개월 정책 (정책 v1 §5.1) | 권고대로 |
| 3 | 카카오 알림톡 vs SMS PG 선택 (Phase E) | 알림톡 도달률·비용 우위 권고 |
| 4 | AWS 서울 단일 계정 vs dev/staging/prod 계정 분리 | 계정 분리 권고 (보안 격리) |

---

## 7. 다음 액션 (즉시 착수)

**Infra 트랙:**
1. Phase 0 부트스트랩 시작 (회사 표준 Terraform/CDK 적용)
2. ECR 리포 3 + GitHub Actions 매트릭스 셋업
3. SES 도메인 인증 시작 (DKIM·DMARC 시간 소요)

**FE 트랙:**
1. 로컬에 `apps/web/` Next.js 스캐폴드
2. 디자인 토큰·Pretendard·shadcn/ui 셋업
3. Phase 0 완료되는 즉시 ECS staging 배포

**Backend 트랙(권고 시):**
1. `apps/api/` NestJS 스캐폴드 + 모듈 구조 잡기 (Phase C 본격 착수 전 셸만)
2. `packages/shared/` Zod 스키마 준비

---

## 8. 변경 이력

| 버전 | 일자 | 변경 |
|---|---|---|
| v0.1 | 2026-05-26 | 초안. 검수자 결정 4.1~4.4 반영. Phase E 이연 4건 명시. 3트랙 권고. Phase 0~E 구조·종료 기준·WBS 정합 |
