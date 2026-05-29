# 회원·인증 정보 v0.1 — Gate keeper DB 설계용

확정일: 2026-05-29 (금)
작성자: 최선혜 (Education Product Owner)
배경: Gate keeper의 DB 설계 의뢰 4문항(회원가입 / 각자 가입 / 인증 진행도 / 필수값) 회신용.
근거 문서: [`002_Admissions_Coach_definition_v.3.md`](002_Admissions_Coach_definition_v.3.md) §2/§3/§6.3 · [`student_profile_schema_v0.1.json`](student_profile_schema_v0.1.json) · [`006_Admissions_Coach_data_security_policy_v0.1.md`](006_Admissions_Coach_data_security_policy_v0.1.md)

> 본 문서는 회원 모델·필수값·동의 정책의 *현 시점 합의*다. Phase E(인증·결제 본격 구현) 시 본 문서를 v0.2로 갱신한다.

---

## Q1. 회원가입은 어떻게 되어 있나요?

**현재 상태: 개발 0%. 기획 v0.1 단계** (회원 모델·동의 흐름·필수값 정의 완료, 코드 미구현). 본격 구현은 Phase E (M3 후반~M4).

**기획 요지**

- **학생/학부모 분리 회원 + 가구(Household) 연결** 모델.
- 학생 = 일상 사용자 (생기부 제출·결과 열람).
- 학부모 = 결제 의사결정자 + 미성년자 보호자 (자녀 진행 *요약*만 노출, 원문 미노출 — 정의 §6.3).
- **미성년자(만 19세 미만) 학생은 본인 동의 + 법정대리인(보호자) 동의 둘 다 필수** → P0 출시 차단 조건 (정의 §6.3 / 정책 §6).
- 보호자 동의 채널: **카카오 알림톡** (확정, Phase E 가동), SMS 백업 검토.
- 인증 스택: **NestJS + Passport (JWT/세션)** — Phase E 구현 예정.

---

## Q2. 지금 사람들마다 회원가입 다 각자 하고 계신지?

**네, 각자 별도 계정 + 가구(Household)로 연결되는 모델**입니다.

### 가입 흐름

```
[학생 우선 가입 경로]
  학생 회원가입 → isMinor=true면 보호자 연락처 입력 필수
  → 보호자에게 카카오 알림톡으로 동의 요청 발송
  → 보호자가 동의 클릭 → 보호자 계정 생성(또는 기존 계정 연결)
  → 가구 연결 + 학생 계정 활성화

[학부모 우선 가입 경로]
  학부모 회원가입 + 결제 → 초대 코드 발급
  → 학생이 초대 코드로 가구 합류 → 학생 계정 활성화
```

- 보호자 동의 *전* 학생 계정은 `pending` 상태로 저장됨 (서비스 이용 차단).
- 학생-학부모 1:1이 기본, 1:N(다자녀 가구)도 모델에서 허용 — 학부모 1명 → 가구 여러 개.

---

## Q3. 인증 관련 개발은 어디까지 진행되셨는지?

**개발 0%.** 현재는 Phase A/B 시각 셸의 [`/consent`](../apps/web/app/consent/page.tsx) 화면에서 동의 3종을 *시각적으로*만 노출 + Phase B 클라이언트 차단 로직(Zod refine으로 미성년→guardian 강제). 백엔드 세션·세이브·실 발송은 모두 없음.

### 진행 예정 (코딩 계획 §4 정합)

| Phase | 인증/회원 관련 작업 |
|---|---|
| **B (현재)** | 클라이언트 측 폼 검증 + `/consent` 차단 로직 (UI 레벨, 백엔드 없음) |
| **C** | NestJS api의 `submission`/`consent` 모듈 — 인증은 익명 토큰 수준 |
| **E (M3 후반~M4)** | **본격 인증·회원·가구·결제·미성년자 보호자 동의 채널 실 구현** |

**가장 가까운 의존:** Phase D(AI 통합)부터는 "이 결과는 누구의 것인가" 식별 필요 → Phase E 인증 전까지는 *내부 검수용 가명 ID*로 대체.

---

## Q4. 필요한 정보, 필수값들은 어떤 항목들이 있는지?

DB 설계용 5 엔티티. 데이터 분류(T1~T4)는 [보안 정책 v0.1 §2](006_Admissions_Coach_data_security_policy_v0.1.md)와 정합.

### ① Student (학생)

| 필드 | 타입 | 필수 | Tier | 비고 |
|---|---|:-:|:-:|---|
| `id` | UUID | ✅ | — | 내부 식별자 |
| `isMinor` | boolean | ✅ | — | 만 19세 미만 여부. true면 보호자 동의 필수 |
| `gradeLevel` | int (1~3) | ✅ | T4 | 고1·고2·고3 |
| `semester` | int (1\|2) | ✅ | T4 | 1·2학기 |
| `schoolType` | enum | ✅ | T4 | `general`(일반고) / `special_purpose`(특목고) / `autonomous`(자사고·자율고) / `ged`(검정고시) |
| `targetTrack` | enum | ✅ | T4 | `humanities`(인문) / `science_engineering`(이공) / `medical`(의치한) / `arts_athletics`(예체능) / `other`(기타) |
| `targetUniversities[]` | jsonb | ❌ | T4 | 최대 3 (선택) |
| `weakAreas` | text | ❌ | T4 | 자유 텍스트 (선택) |
| `status` | enum | ✅ | — | `pending` / `active` / `withdrawn` |
| `createdAt` / `updatedAt` | timestamptz | ✅ | — | |

> **enum 변경 이력 (2026-05-29):** targetTrack을 4계열에서 5계열로 확장. 변경 전 `engineering`(공학) + `medical_natural`(의학·자연) 분리에서 → `science_engineering`(이공, 자연과학 포함) + `medical`(의치한)로 재정의 + `other`(기타) 추가. 본 변경은 정의 v0.3 §3-2 / Zod 스키마 / JSON Schema 모두에 반영됨.

### ② Guardian (학부모)

| 필드 | 타입 | 필수 | Tier | 비고 |
|---|---|:-:|:-:|---|
| `id` | UUID | ✅ | — | |
| `phoneEncrypted` | bytea | ✅ | **T1** | 카카오 알림톡 발송용. 봉투 암호화(Phase E) |
| `phoneHash` | char(64) | ✅ | — | 조회·중복확인용 단방향 해시 |
| `emailEncrypted` | bytea | ❌ | T1 | 선택, SES 보조 채널 |
| `relationToStudent` | enum | ✅ | T4 | `mother` / `father` / `legal_guardian` |
| `paymentProfileRef` | text | ❌ | T1 | Toss Payments 토큰 (Phase E) |
| `createdAt` / `updatedAt` | timestamptz | ✅ | — | |

### ③ Household (가구 — 학생·학부모 연결)

| 필드 | 타입 | 필수 | 비고 |
|---|---|:-:|---|
| `id` | UUID | ✅ | |
| `studentId` | UUID FK→Student | ✅ | |
| `guardianId` | UUID FK→Guardian | ✅ | |
| `inviteCode` | varchar(12) | ❌ | 보호자→학생 초대용. 권고 12자 영숫자·7일 만료 |
| `linkedAt` | timestamptz | ✅ | 가구 연결 시점 |
| 유니크 제약 | `(studentId, guardianId)` | — | 중복 연결 방지 |

### ④ Consent (동의 이벤트, append-only, T3)

| 필드 | 타입 | 필수 | 비고 |
|---|---|:-:|---|
| `id` | UUID | ✅ | |
| `subjectType` | enum | ✅ | `student` / `guardian` |
| `subjectId` | UUID | ✅ | Student 또는 Guardian id |
| `consentType` | enum | ✅ | `terms` / `privacy` / `guardian_for_minor` |
| `version` | varchar | ✅ | 약관 버전 (예: `terms_v1.0`) |
| `granted` | boolean | ✅ | true=동의 / false=철회 |
| `channel` | enum | ✅ | `web` / `kakao_alimtalk` / `sms` |
| `userAgent` / `ipAddress` | text | ✅ | 감사용 |
| `createdAt` | timestamptz | ✅ | |

**무결성:** append-only (UPDATE/DELETE 금지). 철회는 새 row(`granted=false`)로 표현.

### ⑤ AuthCredential (인증, Phase E)

| 필드 | 타입 | 필수 | Tier |
|---|---|:-:|:-:|
| `id` | UUID | ✅ | — |
| `subjectType` | enum (student/guardian) | ✅ | — |
| `subjectId` | UUID | ✅ | — |
| `loginIdHash` | char(64) | ✅ | — |
| `passwordHash` | varchar (argon2id) | ✅ | T1 |
| `lastLoginAt` | timestamptz | ❌ | — |

---

## 필수값 요약 (DDL용)

**학생 생성 시 NOT NULL:** `id`, `isMinor`, `gradeLevel`, `semester`, `schoolType`, `targetTrack`, `status`.

**학부모 생성 시 NOT NULL:** `id`, `phoneEncrypted`, `phoneHash`, `relationToStudent`.

**가구 연결 NOT NULL:** `studentId`, `guardianId`, `linkedAt`.

**미성년 학생 활성화 조건 (애플리케이션 레벨 강제):**
1. Consent `terms` (학생) granted=true
2. Consent `privacy` (학생) granted=true
3. Household 존재 (보호자 연결)
4. Consent `guardian_for_minor` (해당 보호자) granted=true
→ 4개 모두 충족 시 Student.status = `active`. 하나라도 빠지면 `pending` 유지 + 서비스 이용 불가.

---

## 핵심 제약 (보안 정책 §6 정합 — DDL·마이그레이션 단계에서 반영 필수)

1. **T1 평문 컬럼 저장 금지.** 모든 식별 PII(이름·학교명·생년월일·전화·주소·교사명)는 본 DB에 *컬럼으로 가지지 않거나*, 봉투 암호화(KMS)로 저장(Phase E).
2. **마스킹된 입력만 수용.** 학생 생기부 원문은 S3 + 봉투 암호화(Phase E). DB는 참조 ID만.
3. **삭제권:** 학생/학부모 일방 요청 시 T1·T2 즉시 삭제, T3 동의 로그만 *철회 이벤트*로 남김.
4. **보관 기간:** 학생·학부모 T1/T2 = 동의 시점 + 12개월. T3 동의 로그 = 3년 (PIPA §29). 결제 = 5년 (Phase E).
5. **CASCADE 금지 — soft expiry + cron 삭제** (Phase E `@Cron`).

---

## 미해결·미정 (Gate keeper 회신 후 확정)

| 항목 | 권고 |
|---|---|
| ID 발급 전략 | UUID v4 vs ULID — **ULID 권고**(시간 정렬) |
| `isMinor` 산정 방식 | 생년월일 입력 시점 계산 vs 사용자 선언 — **생년월일 권고**(나이 변동 시 자동 reclassify). 생년월일은 T1이므로 봉투 암호화 |
| 초대 코드 길이·만료 | **12자 영숫자, 7일 만료** |
| 다자녀(1 학부모 → N 가구) 결제 | 가구 단위 구독 / 자녀 단위 일회성 — **Phase E** |
| 보호자 변경(이혼·재혼 등) 시 가구 재구성 | 정책 — **Phase E** |
| 학생 학년 진급 자동 reclassify | 정책 — **Phase E** |

---

## 변경 이력

| 버전 | 일자 | 변경 |
|---|---|---|
| v0.1 | 2026-05-29 | 초안. 5 엔티티(Student·Guardian·Household·Consent·AuthCredential) + 필수값 + 5계열 enum(인문/이공/의치한/예체능/기타) + 4 학교유형 enum(일반고/특목고/자사고·자율고/검정고시) 정의. Gate keeper Q1~Q4 응답으로 작성 |
