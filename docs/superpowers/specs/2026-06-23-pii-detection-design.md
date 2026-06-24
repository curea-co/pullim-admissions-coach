# 설계 — 생기부 제출 전 PII 자동 검출·가림 (#17)

- 일자: 2026-06-23
- 작성: 브레인스토밍 세션 (Claude Code)
- 연관 이슈: [#17](https://github.com/curea-co/pullim-admissions-coach/issues/17) (P0)
- 상태: 설계 확정 대기

---

## 1. 배경 / 문제

제품의 **1순위 출시 차단 위험(미성년자 민감정보)** 인데, 현재 마스킹 방어선은 **학생 자기 체크박스 1개**가 전부다. 붙여넣은 텍스트/PDF에서 식별정보를 자동 검출하는 로직이 전혀 없다.

- 마스킹은 전적으로 학생 수작업: `apps/web/app/submit/page.tsx` (안내 문구만).
- 유일한 게이트 = 자기 신고 체크박스 `record.maskingApplied` literal-true: `packages/shared/src/schemas.ts`.
- `maskedFields` 칩은 장식용(`.optional()`, 검증 없음).
- PDF 경로는 전체 텍스트를 그대로 추출 → 페이지마다 이름·학교·교사명이 박혀있는데 "직접 수정"만 안내.
- 정책(`docs/006_...policy`, README)은 "식별정보 마스킹 **기본 강제**"라 명시하나, 라이브 앱은 강제가 아니라 자기신고다.

정책 T1 식별 PII 분류(`docs/006` §): 학생 성명·학교명·생년월일·전화·주소·교사명·법정대리인 정보.

## 2. 목표 / 비목표

**목표**
- 제출 직전(및 입력 중) 클라이언트에서 PII를 자동 검출하고, **고정밀 PII는 제출을 차단**, 저정밀은 경고+2차 확인.
- **원클릭 자동 가림**으로 검출 부분을 카테고리 플레이스홀더로 치환(결과 편집 가능).
- 검출/치환 로직을 `packages/shared` 순수 함수로 두어 Phase C 서버가 동일 게이트를 재사용.
- `maskedFields`를 실데이터(검출·가림 카테고리)로 채우고, 스키마 게이트를 자기신고 → 실제 검출 기반으로 강화.

**비목표 (YAGNI)**
- 서버 NestJS pipe 적용 — 백엔드 부재(Phase C). detector는 재사용 가능하게만 둔다.
- 스캔(이미지) PDF OCR — `pdf.ts`는 텍스트 PDF만(별개 이슈).
- ML/NER 기반 한국어 이름 인식 — 정규식 + 문맥 앵커로 한정.
- 결제·인증·동의 채널(Phase E) 무관.

## 3. 결정 사항 (브레인스토밍 확정)

| # | 결정 | 선택 |
|---|---|---|
| 제출 통제 | **티어드 차단** — block-tier 하드 차단, warn-tier 경고+2차 확인 | 확정 |
| 검출 후 처리 | **원클릭 자동 가림**(카테고리 플레이스홀더 치환, 편집 가능) | 확정 |
| 아키텍처 | 공유 detector(`packages/shared`) + 스키마 superRefine 게이트 + UI 라이브 검출 | 확정 |
| 이름 검출 | 자유 2~4자 매칭 금지, **라벨 인접 문맥 앵커만** | 확정 |
| address tier | warn 유지 | 확정 |

## 4. Detector 모듈 (`packages/shared/src/pii.ts`)

순수 함수 2개:
```
detectPii(text: string): PiiMatch[]
redactPii(text: string, matches: PiiMatch[]): string

PiiMatch = {
  category: PiiCategory,      // 'phone'|'rrn'|'email'|'school'|'name'|'teacher'|'birth_date'|'address'
  tier: 'block' | 'warn',
  index: number,              // 민감 토큰의 시작 (라벨 제외)
  length: number,             // 민감 토큰 길이
  value: string,              // 검출된 원문
  placeholder: string,        // 치환 토큰 (예: '[전화]')
}
```

- `index/length`는 **민감 토큰만** 가리킨다(문맥 앵커의 라벨은 제외) → 정밀 하이라이트·치환.
- `detectPii`는 카테고리별 정규식을 순서대로 적용, 겹치는 매치는 더 긴/앞선 것 우선(중복 제거). 이미 치환된 플레이스홀더(`[...]`)는 재검출하지 않는다.
- `redactPii`는 매치를 **뒤에서 앞으로**(index 내림차순) 치환해 오프셋 깨짐 방지. idempotent.

### 4.1 Block tier (거의 0 오탐 → 하드 차단)
| category | 패턴(요지) | placeholder |
|---|---|---|
| phone | `01[016789]-?\d{3,4}-?\d{4}` 및 지역번호 `0\d{1,2}-?\d{3,4}-?\d{4}` | `[전화]` |
| rrn | `\d{6}-?[1-4]\d{6}` (주민등록번호) | `[주민번호]` |
| email | `[\w.+-]+@[\w-]+\.[\w.-]+` | `[이메일]` |
| school | `[가-힣]{2,}(초등학교|중학교|고등학교|대학교)` | `[학교]` |

### 4.2 Warn tier (문맥 앵커 / 중간 정밀 → 경고+2차 확인)
| category | 패턴(요지) — 민감 토큰은 캡처그룹 | placeholder |
|---|---|---|
| name | `(?:이름|성명)\s*[:：]?\s*([가-힣]{2,4})`, `([가-힣]{2,4})\s*(?:학생|군|양)(?![가-힣])` | `[이름]` |
| teacher | `(?:담임|교사)\s*[:：]?\s*([가-힣]{2,4})`, `([가-힣]{2,4})\s*선생님` | `[교사]` |
| birth_date | `\d{4}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}\s*일?` | `[생년월일]` |
| address | `[가-힣]+(?:시|도)\s?[가-힣]+(?:시|군|구)\s?[가-힣]+(?:읍|면|동|로|길)` | `[주소]` |

> 자유 2~4자 이름 매칭은 하지 않는다(전부 오탐). 이름·교사는 라벨 인접(`이름:`/`담임`/`○○ 선생님`)일 때만 검출.

### 4.3 카테고리 ↔ `maskedFieldEnum` 매핑
`maskedFieldEnum`에 `email` 추가. 매핑: phone→phone, rrn→resident_registration_no, email→email, school→school_name, name→student_name, teacher→teacher_name, birth_date→birth_date, address→address.

## 5. 스키마 게이트 (`packages/shared/src/schemas.ts`)

- `recordSchema`의 `text_paste` 분기에 `superRefine` 추가: `detectPii(text)` 결과에 **block-tier 매치가 1건이라도 있으면 invalid** (`path: ['text']`, 메시지에 검출 카테고리 요약, 예: "전화·학교명이 남아있습니다"). 클라·서버 동일 게이트.
- warn-tier는 스키마에서 막지 않는다(UI 경고+2차 확인으로 처리; false positive를 하드 invalid로 만들지 않음).
- `maskedFieldEnum`에 `email` 추가.
- `maskingApplied`(literal true)·`maskedFields`는 유지하되 의미 변경: 자기신고 → 검출·치환 이력 증빙. `maskedFields`는 UI가 검출·가림한 카테고리로 자동 채움.

## 6. UI 플로우 (`apps/web/app/submit/page.tsx`)

데이터 흐름: 텍스트 붙여넣기/PDF 추출 → `recordText`(동일 경로라 PDF도 자동 커버).

- **라이브 스캔(디바운스 300ms):** `recordText` 변경 시 `detectPii` → 결과 패널. block 🔴 / warn 🟡 카운트·하이라이트.
- **원클릭 「자동 가림」:** `redactPii(recordText, matches)` → `recordText` 치환, 검출 카테고리를 `maskedFields`에 기록. 결과는 텍스트박스에서 수정 가능. 재스캔.
- **제출(`handleSubmit`):**
  - block-tier 잔존 → 기존 `ErrorState`로 차단("전화·학교명 등 식별정보가 남아있어요. 자동 가림을 눌러주세요"). 스키마 superRefine이 이중 보장.
  - warn-tier만 잔존 → 2차 확인("이름/교사로 보이는 항목 N개. 확인했고 그대로 진행" 명시 체크) 후 통과. 이 확인이 `maskingApplied`의 실질 근거.
  - 검출 0건 → 바로 통과.
- 기존 `MaskingChecklist`는 검출 결과 연동으로 대체/축소(수동 체크 → 검출·가림 상태 표시). 자유 텍스트·PDF 양쪽 동일.

검출/치환은 `pii.ts` 함수만 호출(UI는 표현 전담). 정규식·tier 로직은 UI에 중복하지 않는다.

## 7. 테스트

- **Detector 단위테스트(`packages/shared`, vitest):** 카테고리별 양성 + 음성.
  - 양성: `010-1234-5678`, `980101-1234567`, `a@b.com`, `서울고등학교`, `이름: 홍길동`, `김철수 학생`, `담임 박영희`, `이순신 선생님`, `서울시 강남구 역삼동`, `2008.03.15`.
  - 음성(미검출): 자유 2~4자 단어("자료구조"·"동아리"·라벨 없는 "박준호"), 활동 연도("2년 연속"), 일반 숫자, 이미 치환된 `[이름]`.
- **redactPii 테스트:** 라벨 보존("이름: 홍길동"→"이름: [이름]"), 다중 매치, 겹침 없음, idempotent.
- **스키마 게이트 테스트:** block-tier 포함 text → `recordSchema` invalid; warn-only/clean → valid.
- **회귀:** 박준호 mock 등 기존 합성 입력이 block-tier 0건(아니면 mock 정리).

## 8. 영향 파일
- 신규: `packages/shared/src/pii.ts`, `packages/shared/src/pii.test.ts`
- 수정: `packages/shared/src/schemas.ts`(superRefine + `email` enum + index export), `packages/shared/src/index.ts`(barrel)
- 수정: `apps/web/app/submit/page.tsx`(스캔 패널·자동 가림·티어드 게이트), 필요 시 `MaskingChecklist` 컴포넌트
- 수정(1줄): `README.md` / `docs/006_...policy` — "기본 강제" 문구를 실제 동작과 정합

## 9. 리스크 / 하위호환
- 입력 흐름(submit→consent→processing)은 유지. `recordSchema` invalid 케이스가 늘어나므로 박준호 mock·골든 입력이 block-tier 0건인지 확인 필요.
- 정규식 false positive: block-tier는 고정밀이라 낮음. warn-tier는 차단하지 않으므로 오탐이 제출을 막지 않는다.
- 한국어 정규식 유니코드 처리 주의(`[가-힣]`). 테스트로 커버.
- detector는 클라이언트 방어선일 뿐 — 진짜 강제는 Phase C 서버에서 동일 함수 재호출로 완성(본 이슈 범위 밖, 재사용 구조만 확보).
