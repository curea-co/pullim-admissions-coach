# 013 · 입시코치 BE P0 구현 설계 (v0.1)

- 작성일: 2026-07-21
- **상태(2026-07-22 갱신): 게이트키퍼 논의 결과 BE 구현 보류. 본 문서는 설계 기록(재개 시 참조)으로 보존.**
- 대상: `pullim-api` (admissions 서비스, `src/admissions/**`)
- 범위: 정책 v2.0 출시 차단 조건(§2-3·§6·§7) 관련 P0 — **B1 보관 12개월 · B2 저장 암호화 · B3 마스킹 확대 · B10 동의 후 저장**
- 상위 계획: `012_policy_v2_screen_and_backend_plan`
- 작업 방식: gate keeper(나)가 직접 구현, 저장소·마이그레이션은 BE 게이트키퍼와 협업(인지됨). 불확실 시 질의.

> 전제(§2-3): "식별정보 자동가림·법정대리인 동의·보관/삭제·저장보호가 갖춰지기 전에는 **실제 사용자 데이터를 받지 않는다.**"
> → 현재 운영 DB에 실사용 데이터가 없다고 보고, **마이그레이션 백필 리스크는 최소**로 가정한다(착수 시 실측 확인).

---

## B1 — 보관: "생성 후 30일" → "동의 시점 + 12개월"

### 현재
- 상수: `modules/submissions/common/constants/submission.constant.ts:4` `SUBMISSION_RETENTION_DAYS = 30`.
- `purgeAfter = now + 30d` 두 곳에서 계산·기록:
  - `submissions/service/submission.service.ts:44` (submission create)
  - `diagnoses/service/diagnosis.service.ts:58` (diagnosis create)
- 스위퍼: `submission-purge.scheduler.ts:25` 매일 04:00 KST → `submission.repository.ts:30` `delete({ purgeAfter: LessThan(cutoff) })`. consents·diagnosis_results는 FK CASCADE로 동반 삭제.
- 동의 시각: `consent.entity.ts:57 grantedAt @CreateDateColumn`. **단, consent는 submission 생성 이후에 기록**되므로 submission-create 시점엔 동의 시각이 없다.

### 목표
학생 입력·결과물을 **동의 완결 시점 + 12개월** 후 파기(§6). 요청 시 즉시 삭제는 이미 구현됨(DELETE + CASCADE) — 유지.

### 설계
1. 상수 교체: `SUBMISSION_RETENTION_DAYS = 30` → `SUBMISSION_RETENTION_MONTHS = 12` (일 단위 산식 제거).
   - `purgeAfter` 계산 헬퍼 `addMonths(base, 12)`(달력 월 연산; `date-fns` 사용 여부는 레포 관례 확인).
2. **앵커를 동의 완결로 이동**: `ConsentService.record()`(`consent.service.ts:40-79`)에서 **필수 동의(terms+privacy, 미성년이면 guardian)가 모두 채워지는 순간** 해당 submission의 `purgeAfter = addMonths(완결 grantedAt, 12)`를 **재계산·update**한다(동일 트랜잭션).
   - 동의 전 임시 저장분의 `purgeAfter`는 **12개월이 아니라 짧은 quarantine TTL**(예: 24~48h)로 둔다. 12개월 앵커는 동의 완결 update에서만 부여 — 그렇지 않으면 B10 미적용 상태에서 동의 없이 저장된 `recordText`의 보관을 30일→12개월로 **되레 늘려** 정책 위반 폭을 키운다. **B1은 B10과 동일 배포 단위로 강제**(부분 반영 금지).
3. diagnosis_results: 자체 크론 없음(CASCADE로만 파기). `diagnosis.service.ts:58`의 `purgeAfter`도 submission 기준과 정합되게 12개월로. (실질 파기는 CASCADE이므로 인덱스·값은 일관성 목적)

### 마이그레이션
- 컬럼 변경 없음(값 정책만). 기존 행 백필: 운영 데이터 없음 가정 → 불필요. 있으면 `purge_after` 재계산 1회 스크립트.

### 테스트
- 단위: `addMonths` 12개월 경계(윤달·월말). ConsentService.record 완결 시 purgeAfter 재계산. 스위퍼가 cutoff 미달 행 보존/초과 행 삭제.

### 게이트키퍼 확인
- Q1. 앵커 권위 시각 = **서버 수신 `grantedAt`**(권장·법적 감사 신뢰경계) 확정? 클라 `consentTimestamp`는 참고 메타로만. 동의 전 quarantine TTL 값?
- Q2. 12개월 = 달력 월(권장) vs 365일?

---

## B2 — `recordText` 저장 암호화 (§6 · ADR-058 ②)

### 현재
- `entities/submission.entity.ts:57` `@Column({type:'text'}) recordText` — 평문. 주석 "저장 시 암호화는 후속 결정(설계 §8-2)".
- 쓰기: `submission.service.ts:52 maskPII(input.recordText)` → `repo.save`.
- 읽기(유일 소비자): `submission-to-analysis-input.ts:51 saengbu: sub.recordText`, 워커 `diagnosis-worker.service.ts:39 submissions.findById` 경유. DTO는 본문 비노출(`submission-response.dto.ts:8`).

### 핵심 발견 — 재사용 가능한 필드 암호화 인프라 존재
- `common/security/field-cipher-provider.interface.ts` — `FieldCipherProviderInterface.encrypt/decrypt`. 설계 규범: "엔티티 컬럼은 평문 text로 두고 **암호화 책임은 Repository에 위임**".
- `common/security/aes-gcm-field-cipher.provider.ts` — AES-256-GCM, 12B IV, `base64(iv||tag||ct)`. 키 `PII_FIELD_ENCRYPTION_KEY`(시크릿 스토어), 부팅 시 fail-fast. "KMS 승격 시 이 클래스만 교체".
- `field-cipher.module.ts` — `@Global`, `app.module.ts:140` 등록 → admissions repo에서 **추가 배선 없이 주입 가능**.
- **선례(동일 패턴)**: `junior/modules/students/infrastructure/junior-journal.repository.ts`(`cipher.encrypt`로 title/note/text 저장, 읽기 시 decrypt). → 이 파일을 그대로 따른다.

### 설계
1. `SubmissionRepository`(`submissions/infrastructure/submission.repository.ts`)에 `FieldCipherProviderInterface` 주입.
2. `save`: 저장 직전 `recordText = cipher.encrypt(masked)`.
3. `findById`/`listByUser`: 로드 직후 `recordText = cipher.decrypt(...)` (null 가드; junior-learning.repository 패턴).
   - 엔티티 컬럼 타입은 `text` 유지(transformer 미사용 — DI 불가).
4. 워커는 `findById` 경유이므로 복호는 투명. `analyze()`가 마스킹을 멱등 재적용(무해).

### 마이그레이션 / 롤백
- 스키마 변경 없음(값 포맷만). 기존 평문 행: 운영 데이터 없음 가정 → 백필 불필요. 있으면 **1회성 백필** 또는 **명시적 버전 마커**(예: `enc:v1:` 프리픽스)로 평문/암호문 구분.
- **복호 실패를 평문 legacy로 일괄 간주 금지** — 키 오배포·ciphertext 손상·구현 버그를 조용히 숨기고 평문을 downstream에 흘릴 수 있다. 마커 없는 예기치 못한 복호 실패는 **fail-fast(또는 격리·경고)** 로 처리해 조기 탐지.
- `PII_FIELD_ENCRYPTION_KEY` 시크릿 존재 확인(부팅 fail-fast). 로컬/스테이징 키 프로비저닝 = 게이트키퍼.

### 테스트
- repo round-trip: save→findById 복호 일치. 저장 컬럼이 평문이 아님(포맷 검증). null/빈 문자열 가드.

### 게이트키퍼 확인
- Q3. 앱계층 AES-256-GCM(기존 인프라)로 P0 충족 OK? KMS는 후속 1-클래스 스왑으로 유예? (권장: OK)
- Q4. `PII_FIELD_ENCRYPTION_KEY` dev/staging 프로비저닝 상태.
- Q5. 기존 행 존재 시 백필 vs read-both-format — 마이그레이션 오너십.

---

## B3 — LLM 전 마스킹 확대 (§4)

### 현재
- `engine/mask.ts:3-11` — **3종만**: 주민번호·휴대전화·이메일. 이름/교사/학교/생년월일/주소·유선전화 미커버.
- 호출: `engine/analyze.ts:55 maskPII(parsed.saengbu)` — 모든 LLM 단계 전. 저장 시에도 `submission.service.ts:52` 재적용(방어).

### 목표(정책 §4 하드차단+경고 8종)
- 하드차단: 전화·주민번호·이메일·**학교명**. 경고: 이름·교사·주소·생년월일.
- FE `packages/shared/src/pii.ts`(8종·11 규칙)가 SoT. **단, `@pullim/shared`는 pullim-api 의존성 아님**.
- **드리프트 위험(중요)**: 가장 민감한 PII 판별 로직을 FE/BE로 **이중화하면**, 한쪽 정규식만 고쳐질 때 "FE는 차단, BE는 미마스킹 통과"라는 정합성 버그가 발생한다. 단순 포팅은 이 위험을 남긴다 → **규칙 원본 단일화 장치를 설계에 포함**(아래 Q6).

### 설계
1. `engine/mask.ts`의 PATTERNS를 FE 11 규칙과 정합되게 확장(주민 `\d{6}-?[1-4]\d{6}`, 유선전화 포함, 학교 `[가-힣]{2,}(?:초·중·고)`, 이름/교사 라벨 인접 2종, 생년월일, 주소).
2. BE는 tier 구분 불필요 — **모든 식별 카테고리를 redact**(치환)만 하면 됨. 플레이스홀더 문자열 통일(FE `[전화]` 등과 맞추거나 BE 내부 일관성 유지 — 표시용 아님).
3. 단일 chokepoint 유지: `analyze.ts`의 1패스 + 저장 시 재적용. 추가 단계 불필요.

### 리스크
- 과탐(정상 텍스트 오마스킹) — FE와 동일 규칙이라 동등 수준. 회귀 테스트로 고정.
- **FE/BE 규칙 드리프트(핵심 리스크)** — 픽스처 공유만으로는 부족. **규칙 정의(정규식+카테고리)를 단일 소스**에서 파생시켜야 한다:
  (a) `@pullim/shared`를 pullim-api 의존성으로 추가해 규칙을 직접 공유(권장, cross-repo 배포 가능 시), 또는
  (b) 규칙을 언어중립 산출물(JSON 등)로 코드젠해 양 리포가 소비, 또는
  (c) 불가피하게 포팅 시 **드리프트 감지 계약 테스트**(동일 입력셋에 대해 FE·BE redact 결과 일치 검증)를 CI 게이트로. — 착수 시 Q6로 확정.

### 테스트
- `engine/mask.test.ts`: 8종 각 1+ 케이스 + 미탐/과탐 경계. FE `pii.test`와 동일 입력 픽스처.

### 게이트키퍼 확인
- Q6. 규칙 단일 소스 방식: (a) `@pullim/shared` 직접 의존 / (b) 언어중립 코드젠 / (c) 포팅 + 드리프트 감지 계약 테스트 중 택. **민감 로직 이중화 위험상 (a)/(b) 우선, 불가 시 (c) 필수** — 단순 포팅(감지장치 없음)은 비권장.

---

## B10 — 동의 확인 후에만 저장 (§2-3 · §6)

### 현재(문제)
- 저장이 동의보다 **먼저** 일어난다.
  - `create-submission.use-case.ts:11` → `submission.service.ts:41-57` 저장에 동의 확인 없음.
  - FE `admissions-api.ts submitAndDiagnose`: ① `POST /submissions`(본문 영속) → ② `POST /consents` → ③ `POST /diagnose`. `toAnalysisInput`은 "동의 완결 후 생성"을 **가정하지만 실제와 불일치**.
- 진단 게이트는 있음(`diagnosis.service.ts:48-57` terms+privacy 없으면 403) — **저장 게이트는 없음**.

### 목표
본인(+미성년 보호자) 동의가 확인되기 전에는 `recordText`를 저장하지 않는다.

### 설계 — 원자적 제출(권장안 A)
`POST /admissions/submissions`가 **본문 + 동의를 함께 받아 한 트랜잭션**에서 submission + consents를 생성. 동의 검증(terms+privacy, 미성년 guardian, 서버 권위 isMinor)을 통과해야만 `recordText` 영속.
- BE: `submission-request.dto`에 `consents`(각 항목 + **클라이언트 `consentTimestamp`**) 추가, `submission.service.create`가 `ConsentService`의 검증 로직 재사용해 동일 tx에 저장. 실패 시 롤백(저장 안 됨).
- **동의 시각 권위값(보안 경계)**: 법적 동의·보관 기준 시각은 **서버 수신 시각(`grantedAt @CreateDateColumn`)을 권위값**으로 유지한다. 단말 시계는 사용자가 임의 조작 가능해 서버가 실제 동의 시점을 독립 입증할 수 없으므로, FE의 `consentTimestamp`는 **참고 메타데이터로만 별도 저장**(권위값 아님). B1 앵커도 서버 `grantedAt` 기준. (수신 지연은 동의→저장을 원자적 tx로 묶어 최소화.)
- FE: consent 화면에서 이미 동의를 수집하므로, `submitAndDiagnose`를 **①(본문+동의) → ②diagnose 2콜**로 축소. 재시도 지문 재사용 로직 정합.
- purgeAfter 앵커(B1)도 이 tx에서 확정 가능(동의 시각 존재) → B1·B10 결합 시 앵커 문제 자연 해소.
- **서버측 멱등(필수)**: 2콜 축소만으로는 재시도 정합성이 해결되지 않는다. `POST /submissions`가 **DB 커밋 후 응답 전에 끊기면** 클라이언트는 submissionId 없이 동일 payload를 재전송 → **동일 민감 본문 + append-only consent 레코드 중복 생성**(저장량·감사 정합성 악화).
  - **대응(권장)**: 요청 단위 **명시적 `Idempotency-Key` 헤더 + 짧은 TTL 저장**(응답 유실 재시도만 복구). 키는 **인증 userId + 정규화 요청 fingerprint에 바인딩**해 저장한다. 동일 키+동일 payload 재요청만 기존 submissionId 반환, **동일 키+다른 payload는 409 충돌로 거절**(다른 제출이 잘못 합쳐지거나, 키를 아는 다른 요청이 남의 submissionId를 받는 정합성·보안 문제 방지).
  - **payload fingerprint(본문해시+userId)는 dedupe 키로 승격 금지** — 그것은 세션 내 재시도 복구용 보조 수단일 뿐. 전역 유일키로 쓰면 **며칠 뒤 동일 생기부로 재진단하는 정상 재제출을 영구 중복으로 오인**한다. fingerprint는 관측/보조 매칭 용도로만.

### 대안 B(비원자적, 소변경)
`POST /submissions`는 본문 저장을 보류(메타만)하고 diagnose 시 동의 확인 후 본문 확정 — 데이터 모델 변경 커 비권장.

### 리스크
- FE 3콜→2콜 변경은 admissions-coach PR 동반 필요(계약 변경). 순서·재시도 회귀 테스트.

### 테스트
- 동의 누락 요청 → 저장 안 됨(403, DB에 submission 없음). 미성년 guardian 누락 → 저장 안 됨. 정상 → submission+consents 동시 존재.
- **멱등**: 동일 `Idempotency-Key` 재요청 2회 → submission 1건만(중복 없음), 동일 submissionId 반환.
- **재제출 허용 경계**: 키 없이(또는 TTL 경과 후) 동일 생기부 재제출 → **신규 submission 생성 허용**(정상 재진단 차단 안 됨).

### 게이트키퍼/FE 확인
- Q7. 권장안 A(원자적 제출, `POST /submissions`에 consents 포함)로 확정? → BE 계약 변경 + FE 2콜 리팩터 동반. (B1 앵커와 함께 처리하면 이득)
- Q8. 멱등: 명시적 `Idempotency-Key`(짧은 TTL, 권장) 확정 + TTL 값? (payload fingerprint는 dedupe 키 아님 — 관측용). 재제출 허용 경계 정책.

---

## 실행 순서(2026-07-22~)

1. **B3 마스킹 확대** — 독립·저위험, 즉시 착수 가능(엔진 순수함수 + 테스트).
2. **B2 저장 암호화** — 기존 cipher 인프라 재사용, junior-journal 패턴. 키 프로비저닝 확인 후.
3. **B10 원자적 제출 + B1 동의 앵커 보관** — 결합 처리(동의 시각을 저장·앵커에 함께 사용). BE 계약 변경 → FE(admissions-coach) 동반 PR.

브랜치/PR: pullim-api는 게이트키퍼 브랜치 모델 따름(마이그레이션은 게이트키퍼 적용). FE 동반 변경은 admissions-coach feature→dev.

## 게이트키퍼 오픈 질문 요약
Q1 앵커 시각 / Q2 12개월 정의 / Q3 AES vs KMS / Q4 암호화 키 프로비저닝 / Q5 백필 오너십 / Q6 규칙 단일소스(드리프트 방지) / Q7 원자적 제출 계약 변경 승인 / Q8 멱등 방식.

## 부록 · 참조 파일(file:line)
- 보관: `submission.constant.ts:4`, `submission.service.ts:44`, `diagnosis.service.ts:58`, `submission-purge.scheduler.ts:25`, `submission.repository.ts:30`, `consent.entity.ts:57`
- 암호화: `submission.entity.ts:57`, `common/security/{field-cipher-provider.interface,aes-gcm-field-cipher.provider,field-cipher.module}.ts`, `junior/.../junior-journal.repository.ts`, `submission-to-analysis-input.ts:51`, `diagnosis-worker.service.ts:39`
- 마스킹: `engine/mask.ts:3`, `engine/analyze.ts:55`, `packages/shared/src/pii.ts`(admissions-coach)
- 동의 후 저장: `create-submission.use-case.ts:11`, `submission.service.ts:41`, `consent.service.ts:40`, `diagnosis.service.ts:48`, `admissions-api.ts submitAndDiagnose`(admissions-coach)
