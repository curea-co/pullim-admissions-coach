# System Architecture v0.1

확정일: 2026-05-26 (화)
작성자: 최선혜 (Education Product Owner) / AI(Product Manager) 작성
연관 문서: `002_Admissions_Coach_definition_v.3.md`, `006_Admissions_Coach_data_security_policy_v0.1.md`, `004_Admissions_Coach_coding_plan_v0.1.md`

> **이 문서의 위치:** 백엔드·인프라 비전공자가 시스템 전반을 검수할 수 있도록 그린 아키텍처 청사진. 회사 표준 AWS 인프라 구성을 그대로 채택하고, 본 서비스 특성(미성년자 데이터·24h SLA·AI·학부모 리포트)에 필요한 컴포넌트를 명시한다.

---

## 1. 개요

### 1.1 시스템이 하는 일

생기부를 입력받아 학종 면접 준비 팩·생기부 진단 가이드·부족 활동 보완안 3종을 24h 안에 산출하고, 학부모에게 주 1회 진행 리포트를 발송한다.

### 1.2 주요 행위자

| 행위자 | 진입 채널 | 권한 |
|---|---|---|
| 학생 (1차 사용자) | `pullim.curea.co` | 자신의 입력 제출, 결과 열람, 삭제 요청 |
| 학부모 (2차/결제자) | `pullim.curea.co` (로그인 후 학부모 화면) | 결제, 자녀 주간 리포트 열람, 동의 |
| EPO·운영자 (내부) | `admin.pullim.curea.co` | 검수 큐 확인, 골드 데이터 비교, §6 가드레일 위반 알림 처리 |
| 시스템 작업 (AI 잡, cron) | 내부 큐·스케줄러 | 비대화형 처리 |

---

## 2. 컴포넌트 토폴로지 (AWS)

회사 표준 인프라를 그대로 채택. 이 서비스 특성에 필요한 컴포넌트만 추가 표시.

```
                                  ┌───────────────────┐
       Internet ──── Route 53 ────┤      AWS WAF      │
                                  │ (Managed + Rate)  │
                                  └─────────┬─────────┘
                                            │
                                  ┌─────────▼─────────┐
                                  │   ALB (퍼블릭)    │
                                  │ Host 헤더 분기    │
                                  └──┬──────┬────┬────┘
                                     │      │    │
                pullim.curea.co  ────┤      │    │  admin.pullim.curea.co
                api.pullim.curea.co ────────┤    │
                                     │      │    │
                              ┌──────▼──┐ ┌─▼──┐ ┌▼──────┐
                              │ Web ECS │ │API │ │Admin  │
                              │ Next.js │ │ECS │ │ ECS   │
                              │ (priv)  │ │Nest│ │Next.js│
                              └─────────┘ │.js │ │(pub)  │
                                          │(pub)│└───────┘
                                          └─┬─┬─┘
                                            │ │
                              ┌─────────────┘ └───────┐
                              │                       │
                       ┌──────▼──────┐         ┌─────▼─────┐
                       │ Redis (ECS, │         │RDS Postgres│
                       │  private)   │         │Multi-AZ    │
                       │  Service    │         │(private)   │
                       │  Connect    │         └────────────┘
                       │  BullMQ 큐  │
                       └─────────────┘
                              │
              ┌───────────────┼───────────────┬─────────────┐
              │               │               │             │
       ┌──────▼──────┐ ┌──────▼──────┐ ┌─────▼──────┐ ┌────▼─────┐
       │  S3 버킷    │ │     SES     │ │ Anthropic  │ │   Toss   │
       │ (PDF 업로드)│ │ (메일 발송) │ │ Claude API │ │ Payments │
       │ 퍼블릭 차단 │ │             │ │ (Opus 4.7) │ │ (Phase E)│
       │ Presigned   │ │             │ │            │ │          │
       └─────────────┘ └─────────────┘ └────────────┘ └──────────┘

         NAT Gateway: 프라이빗 서브넷의 아웃바운드 (Anthropic·Toss·SES 호출)
         Bastion EC2: DB 점프 (SSM Session Manager 우선)
         ECR + GitHub Actions: 빌드 → 푸시 → ECS 배포
```

### 2.1 ECS 서비스 3개

| 서비스 | 도메인 | 역할 | 서브넷 |
|---|---|---|---|
| `web` | `pullim.curea.co` | Next.js — 학생·학부모 화면 (랜딩·입력·동의·결과·리포트) | 프라이빗 |
| `api` | `api.pullim.curea.co` | NestJS — 도메인 로직·AI 호출·큐·인증 | 퍼블릭 (회사 표준) |
| `admin` | `admin.pullim.curea.co` | Next.js — EPO 검수 도구 (큐·골드 비교·가드레일 위반 알림) | 퍼블릭 |

### 2.2 데이터 저장소

| 자산 | 용도 |
|---|---|
| RDS Postgres (Multi-AZ, private) | 회원·동의·제출 메타·결과 인덱스·감사 로그 |
| S3 버킷 (PDF 업로드, 퍼블릭 차단) | 생기부 원문 PDF·텍스트, Presigned URL로 전달 |
| S3 버킷 (결과물) | AI 산출물 JSON·PDF 리포트 |
| Redis (ECS Service Connect) | BullMQ 잡 큐, 세션, rate-limit 카운터 |

### 2.3 외부 의존

| 의존 | 사용처 | 시점 |
|---|---|---|
| Anthropic Claude API (Opus 4.7) | NestJS → 출력 3종 생성, prompt caching 활용 | Phase D~ |
| AWS SES | 학부모 주간 리포트, 인증 메일, 동의 확인 메일 | Phase E |
| Toss Payments | 학부모 결제 | Phase E |
| 카카오 알림톡 / SMS PG | 법정대리인 동의 채널 | Phase E |

---

## 3. 주요 흐름 (Sequence)

### 3.1 학생 제출 → 24h 결과 노출

```
학생 (web)                api (NestJS)             Redis (BullMQ)     Anthropic        S3
  │                          │                          │                 │             │
  │── 입력 5항목 + 동의 ────▶│                          │                 │             │
  │   (Zod 검증, schema       │                          │                 │             │
  │    v0.1과 동기)           │                          │                 │             │
  │                          │── submission 저장 ─────▶ RDS               │             │
  │◀── Presigned URL ────────│                          │                 │             │
  │── PDF 업로드 ──────────────────────────────────────────────────────────────────────▶│
  │                          │── 잡 enqueue (24h SLA) ─▶│                 │             │
  │◀── "접수됨, 24h 안내" ──│                          │                 │             │
  │                          │                          │                 │             │
  │                       (워커: BullMQ 컨슈머)         │                 │             │
  │                          │◀── 잡 dequeue ───────────│                 │             │
  │                          │── PDF 파싱 + 마스킹 검증 │                 │             │
  │                          │── 시스템 프롬프트(§6 가드레일) + 입력 ───▶│             │
  │                          │◀── 3종 산출물 ──────────────────────────── │             │
  │                          │── 산출물 저장 ──────────────────────────────────────────▶│
  │                          │── 결과 인덱스 ─────────▶ RDS               │             │
  │                          │── 학생·학부모 알림 ─────▶ SES              │             │
  │◀── (재방문) 결과 열람 ─│                          │                 │             │
```

**24h SLA 시계:** BullMQ 잡 enqueue 시각 = 시작. 결과 노출 시각 = 종료. 23h 임계 시 운영 알림(Phase D 산출).

### 3.2 학부모 주간 리포트 (cron 비동기)

```
NestJS @Cron(주 1회)          RDS              SES
  │                            │                 │
  │── 가구별 진행 집계 ──────▶│                 │
  │◀── 집계 결과 ─────────────│                 │
  │── 학부모용 리포트 렌더 ──────────────────── │
  │── SES 발송 ──────────────────────────────── │
```

리포트 렌더는 §6.3 가드: 학생 생기부 원문·결과물 전문은 노출하지 않고 진행 요약만.

### 3.3 EPO 검수 (admin)

```
EPO (admin)            api (NestJS)            RDS / S3
  │                       │                       │
  │── 검수 큐 조회 ──────▶│                       │
  │                       │── 미검수 산출물 목록 ─▶│
  │◀──── 큐 목록 ─────────│                       │
  │── 산출물 열람 ────────▶│                       │
  │                       │── S3 산출물 fetch ────▶│
  │◀── 본문 + 골드 비교 ─│                       │
  │── 가드레일 위반 마킹 ▶│                       │
  │                       │── 로그(T3 append) ────▶│
  │── 프롬프트 개선 메모 ▶│                       │
```

가드레일 자동 탐지(§6.1/6.2 키워드 검출) 결과를 admin에서 색상 표시 → EPO가 빠르게 우선순위 판단(Phase D 산출).

---

## 4. 데이터 흐름·분류 정합

`006_Admissions_Coach_data_security_policy_v0.1.md`의 T1~T4 분류와 어디서 어떻게 다뤄지는지:

| 흐름 단계 | 데이터 Tier | 저장소 | 암호화 |
|---|---|---|---|
| 입력 (마스킹된 생기부) | T2 | S3 PDF 버킷 | SSE-S3 (Phase 0~D) → SSE-KMS + 봉투 (Phase E) |
| 식별 PII (회원·결제) | T1 | RDS | 표준 → KMS + pgcrypto (Phase E) |
| 동의 이벤트 | T3 | RDS append-only | 표준 |
| AI 결과물 | T2 | S3 결과물 버킷 | 동일 단계적 |
| 큐 페이로드 | (참조 ID만) | Redis | TLS in transit; 원문 미저장 |
| 학부모 리포트 메일 | (요약, T2 일부) | SES 전송 | TLS, 본문 최소화 |
| 감사 로그·접근 로그 | T3 | CloudWatch Logs + RDS | 표준, 마스킹 필터 |

---

## 5. Phase별 컴포넌트 활성화 매트릭스

| 컴포넌트 | Phase 0 | A | B | C | D | E |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| VPC·ALB·WAF·Route53 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ECS web | – | ✅(정적 mock) | ✅(폼) | ✅ | ✅ | ✅ |
| ECS api | shell | shell | shell | ✅(mock) | ✅(AI) | ✅(전체) |
| ECS admin | shell | shell | shell | ✅(큐) | ✅(검수) | ✅ |
| RDS | shell | – | – | ✅(스키마) | ✅ | ✅ |
| Redis (BullMQ) | shell | – | – | ✅ | ✅ | ✅ |
| S3 (PDF/결과물) | ✅ | – | – | ✅ | ✅ | ✅(KMS) |
| SES | 도메인 인증만 | – | – | – | – | ✅ |
| Anthropic API | – | – | – | – | ✅ | ✅(캐싱) |
| Toss Payments | – | – | – | – | – | ✅ |
| 카카오/SMS | – | – | – | – | – | ✅ |
| CloudWatch/Sentry 알림 | 로그 수집만 | – | – | – | – | ✅(대시보드) |
| KMS 봉투 암호화 | – | – | – | – | – | ✅ |
| 보관/삭제 cron | – | – | – | shell | shell | ✅ |

**원칙:** 실 미성년자 데이터는 Phase E 완료 이후에만 받는다 (`006_..._data_security_policy_v0.1.md` §4 단계적 시행).

---

## 6. 환경

| 환경 | 도메인 | 데이터 |
|---|---|---|
| dev (로컬) | localhost | 박준호 mock·합성 |
| staging | `staging.pullim.curea.co` | 합성·골드(가명) |
| prod | `pullim.curea.co` | 실 사용자 (Phase E 출시 후) |

각 환경은 독립 AWS 계정 또는 독립 VPC + 독립 KMS 키. RDS·S3 별도. 데이터 교차 금지.

---

## 7. 핵심 결정 사항 (decisions log)

| # | 결정 | 근거 | 일자 |
|---:|---|---|---|
| 1 | 백엔드 = NestJS (Next.js Route Handlers 불사용) | 회원 DB·도메인 모듈·큐·인증 복잡도 | 2026-05-26 |
| 2 | DB = AWS RDS Postgres 서울 리전 (Vercel Postgres 폐기) | PIPA·미성년자 데이터 주권 | 2026-05-26 |
| 3 | 회사 표준 AWS 인프라 그대로 채택 (ECS + ALB + WAF + Route53 등) | 사내 자산·운영 노하우 활용 | 2026-05-26 |
| 4 | 모노레포 3 앱 (web/api/admin) | 검수 도구·학생/학부모 화면 분리, 스키마 일원화 | 2026-05-26 |
| 5 | 결제·KMS·알림톡·CloudWatch 대시보드 = Phase E로 이연 | 시각 구현 우선 + 실 미성년자 데이터는 Phase E 이후 | 2026-05-26 |
| 6 | 트랙 분담 = 3트랙(DevOps/Backend/FE) 권고, 인력 부족 시 2트랙(Platform/Product) | 백엔드는 인프라와 별개 작업량 | 2026-05-26 |

---

## 8. 변경 이력

| 버전 | 일자 | 변경 |
|---|---|---|
| v0.1 | 2026-05-26 | 초안. 회사 표준 인프라 + 본 서비스 컴포넌트 매핑, 3개 핵심 흐름, Phase별 활성화 매트릭스, 데이터 분류 정합 |
