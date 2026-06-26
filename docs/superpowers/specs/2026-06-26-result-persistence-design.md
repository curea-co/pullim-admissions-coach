# 설계 — 결과 영속 (C, 릴리즈 P0)

- 일자: 2026-06-26
- 대상: `apps/web` 결과 저장(자기답변·저장 진단) + 서버 영속 연동 지점
- 상태: 설계 + 스캐폴드(스왑 포인트). 실 백엔드 연동은 직원.

---

## 1. 배경 / 문제
결과·자기답변·저장 이력이 현재 **브라우저 저장소**에만 있다:
- `lib/result-view.ts` — 분석 결과(AnalyzeResult): **sessionStorage**(탭 수명, 단계 간 전달).
- `lib/result-store.ts` — 자기답변·저장 진단: **localStorage**.

**알려진 위험(공개 전 해소):** `result-store.ts`가 **사용자 스코프 없이** localStorage에 저장 → 공용 브라우저에서 다른 사용자가 로그인하면 **이전 사용자 데이터 노출**. (RELEASE-HANDOFF §3.2)

## 2. 목표 / 비목표
**목표**
- 결과 저장을 **단일 스왑 포인트**(`ResultStore` 인터페이스) 뒤로 — 직원이 localStorage→서버 한 곳에서 교체.
- **즉시 완화:** `result-store`를 **사용자 스코프** 키로 격리(교차사용자 노출 차단).
- 마이페이지 이력·결과 재진입이 사용자별 서버 저장분을 읽을 수 있는 구조.

**비목표(후속/직원)**
- 실제 백엔드 결과 저장 모듈(스키마·API) 구현 — pullim-api 또는 입시 전용 백엔드.
- AnalyzeResult 자체의 서버 저장(현재 sessionStorage 유지) — 잡큐/DB와 함께.
- 동기→비동기 소비처 마이그레이션(아래 §5)은 백엔드 연동 시.

## 3. 아키텍처 (AuthAdapter 패턴)
- **`lib/result/store-types.ts`** — `ResultStore` 인터페이스(비동기): `getAnswer`·`setAnswer`·`listDiagnoses`·`saveDiagnosis`·`getDiagnosis`. 서버/로컬 공통 계약.
- **`lib/result/scope.ts`** — `currentScope()`(저장 격리 키) + `setUserScope(userId)`. 지금은 mock 세션 기준, B 연동 시 실 user id 주입.
- **`lib/result/local-core.ts`** — 사용자 스코프 localStorage CRUD(동기 코어). 교차사용자 격리.
- **`lib/result/local-store.ts`** — `ResultStore` 로컬 구현(코어의 async 래퍼).
- **`lib/result/api-store.ts`** — `ResultStore` 서버 구현 **스켈레톤**(lib/api.ts, TODO).
- **`lib/result/index.ts`** — 스왑 포인트: `export const resultStore = localResultStore;` → 백엔드 준비 시 `apiResultStore`로 교체.

## 4. 즉시 완화 — 사용자 스코프
- `result-store.ts`(현 동기 소비처 유지)를 `local-core`로 위임 → 키를 `…:${currentScope()}`로 격리.
- `currentScope()`는 활성 세션(현재 mock `puds-auth-session`)을 읽어 사용자별 분리. 로그아웃/계정전환 시 다른 스코프 → 노출 없음.
- B 연동 시 `auth-provider`가 로그인/로그아웃에서 `setUserScope(user.id | null)` 호출하도록 연결(스캐폴드에 주석).

## 5. 동기 → 비동기 마이그레이션(백엔드 연동 시, 직원)
현 소비처(`self-answer.tsx`·`result-actions.tsx`·`mypage`)는 **동기** `result-store` 함수를 쓴다. 서버 저장은 비동기이므로, 백엔드 연동 시 이 소비처를 `resultStore`(async)로 옮기고 로딩/에러 처리를 추가한다. 스캐폴드는 두 경로를 공존시켜 **마이그레이션 전까지 앱이 그대로 동작**한다(로컬·스코프 적용).

## 6. 안전 / §6
- 결과·자기답변은 학생 기록 파생 민감 정보 → 서버 저장 시 사용자 스코프 + 삭제권(개인정보) 보장. §6 정직 라벨(데모 플래그)·합격%/점수 없음 유지.
- 클라이언트 저장은 마스킹된 파생 데이터에 한정(원문 PII 없음). 근본 방어는 서버 저장 + B(인증).

## 7. 테스트
- `scope`·`local-core`: 스코프별 격리(서로 다른 스코프가 데이터 공유 안 함), 라운드트립, 중복 저장 방지, 최신순.
- 기존 `result-store.test.ts` 무회귀(단일 스코프).
- `api-store`는 스켈레톤 — 백엔드 DTO 확정 후 lib/api 목으로 단위 테스트.

## 8. 범위 밖 (후속)
백엔드 결과 저장 스키마·API · AnalyzeResult 서버 저장 · 잡큐 · 마이페이지 "다시 보기" `/result?id=` 라우팅(서버 저장 후).
