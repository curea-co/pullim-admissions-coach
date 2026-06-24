# 설계 — 인증 + 마이페이지 (기능 완성 / mock 어댑터, v1)

- 일자: 2026-06-24
- 대상: `apps/web` (입시 코치 프론트)
- 기반(base): **`feat/puds-adoption`** (PUDS 대시보드·랜딩·로고 위)
- 방침: **지금은 mock으로 기능 완성, pullim-api 실연동은 직원이 후속.** mock↔실연동 교체 비용 0이 되도록 인터페이스를 동일하게 맞춘다.
- 상태: 설계 확정(브레인스토밍 승인) → 플랜 대기

---

## 1. 배경 / 방침
입시 코치는 로그인 없이 제출→결과까지 가는 프로토타입이다. 가입·로그인·마이페이지를 **기능적으로 완성**하되, 백엔드(pullim-api) 실연동은 보류한다. pullim-api에는 이미 인증·계정이 구현돼 있다(이메일/소셜 가입, httpOnly 쿠키+CSRF, `GET /me`, 미성년 보호자 동의, entitlements, account-delete). 따라서 본 작업은:
- **`AuthAdapter` 인터페이스**를 정의하고 **MockAuthAdapter**(localStorage)로 동작시킨다.
- 나중에 직원이 **PullimApiAuthAdapter**(직접 호출 + CORS/쿠키 + CSRF)만 구현해 교체한다 — 화면·흐름은 불변.

## 2. 목표 / 비목표
**목표**
- 진단 전 **가입·로그인 필수** 게이팅, **이메일+비번+(인증코드)+미성년 보호자 동의** UI 완성.
- **마이페이지**: 프로필·요금제·미성년 동의 상태·**진단 이력(mock)**·로그아웃·회원탈퇴 — "완성된 느낌".
- 데이터는 mock이되 **인터페이스는 pullim-api와 동형**.

**비목표**
- pullim-api 실연동(직원 후속), 실 AI 결과·결과 영속(별 하위프로젝트), 소셜 OAuth, KCB 본인인증, 결제.
- #19 3역량·#17 PII·#27 자기답변 — **이미 미머지 체인 소속(중복 금지)**.

## 3. 결정 사항 (확정)
| 항목 | 결정 |
|---|---|
| 연동 | **mock 어댑터** now, pullim-api 실연동은 직원 후속 |
| 기반 | feat/puds-adoption |
| 게이팅 | 진단 전 가입 필수 |
| 수단 | 이메일+비번+인증코드+미성년 보호자 동의 (mock) |
| 마이페이지 | 계정 + **진단 이력 mock 포함** |
| 가드 | 클라이언트 가드(세션 = mock) |

## 4. 아키텍처
- **`lib/auth/adapter.ts` — `AuthAdapter` 인터페이스** (교체 지점):
  ```ts
  type User = { id; email; displayName; ageBand: 'under14'|'over14'|'unknown';
                isMinor; guardianConsent: 'none'|'pending'|'approved';
                package: string; tier: string };
  interface AuthAdapter {
    getMe(): Promise<User | null>;
    signup(input): Promise<{ user: User; needsEmailVerify: boolean; needsGuardianConsent: boolean }>;
    verifyEmail(code): Promise<void>;
    submitGuardianConsent(input): Promise<void>;
    login(email, password): Promise<User>;
    logout(): Promise<void>;
    deleteAccount(): Promise<void>;
    listDiagnoses(): Promise<DiagnosisSummary[]>; // mock 이력
  }
  ```
- **`lib/auth/mock-adapter.ts` — `MockAuthAdapter`**: localStorage 키(`puds-auth-user`, `puds-auth-users`)로 가입·세션·이력 시뮬레이션. 비번은 평문 저장 금지 — mock도 해시 흉내(혹은 저장 안 함, 세션만). 인증코드는 고정/콘솔. **진단 이력 2~3건 가짜 시드**.
- **`lib/auth/index.ts`**: `export const auth: AuthAdapter = mockAuthAdapter` — **직원은 이 한 줄만 pullim-api 어댑터로 교체**.
- **`components/auth-provider.tsx`('use client')**: 마운트 시 `auth.getMe()`로 하이드레이트. 노출 `user/status('loading'|'authed'|'guest')/signup/login/logout/refresh`. `app/layout.tsx`에서 `AppShell` 감싸 제공.
- **라우트 보호 = 클라 가드**(`RequireAuth` 래퍼): `status==='guest'`면 `/login?next=`.

## 5. 페이지
| 화면 | 내용 |
|---|---|
| `/signup` | 이메일·비번·이름·생년월일 → 만나이 미성년 판정. 제출 후: (인증코드 단계) → 미성년이면 **보호자 동의** 단계(보호자 이름·관계·연락처, mock 승인). |
| `/login` | 이메일·비번 로그인. "비밀번호를 잊으셨나요?"는 후속. |
| `/mypage` | 프로필(이름·이메일·연령대·미성년 동의 상태) · 요금제(package/tier) · **진단 이력(mock 카드 목록 — 날짜·계열·요약, '다시 보기'→/result)** · 로그아웃 · 회원탈퇴(확인 모달). |
| 상단바(DashboardShell actions) | 로그인 시 이름+마이페이지+로그아웃 / 비로그인 시 로그인·가입. 모바일 OsTabbar에도 반영. |

- **보호 라우트**: `/submit·/consent·/processing·/result·/mypage` → 미로그인 시 `/login?next=`. **공개**: `/·/login·/signup`.
- **랜딩 CTA**: 미로그인 → `/signup`, 로그인 → `/submit`. 학생/학부모 분기 카드도 동일 게이팅.

## 6. 미성년 보호자 동의 (mock)
- 가입 시 미성년이면 **보호자 동의 1회**(mock: 보호자 정보 입력 → 즉시 'approved' 시뮬레이션, 실제론 직원 연동 시 카카오 알림톡). `User.guardianConsent` 상태로 추적.
- 기존 제출별 `/consent`(#17 체인)의 "미성년 법정대리인 동의"는 **계정 동의를 참조**하도록 후속 조율(체인 머지 후).

## 7. 에러 / 검증
- 폼 검증: 이메일 형식·비번 강도(8자+)·생년월일 유효·필수 보호자 정보. 인라인 필드 에러.
- mock 에러 시뮬: 이미 가입된 이메일, 인증코드 불일치 → 에러 메시지 경로도 구현(실연동 시 동일 표면).
- 세션 없음 → 가드 리다이렉트.

## 8. 테스트
- **vitest**: `MockAuthAdapter`(가입→세션→getMe→logout, 미성년 분기, 이력 시드), 폼 검증 유틸.
- **수동 e2e**: 가입(성인/미성년)→로그인→마이페이지(이력 보기)→로그아웃→탈퇴 · 보호 라우트 가드 · 랜딩 CTA 게이팅.
- typecheck + `next build`.

## 9. 교체 가이드 (직원 후속용 — 문서화)
`docs/`에 "pullim-api 어댑터 교체" 노트: ① `lib/auth/index.ts`의 export를 `PullimApiAuthAdapter`로 ② `lib/auth/pullim-adapter.ts` 구현(직접 호출+credentials+CSRF, 엔드포인트 매핑은 `2026-06-24-auth-mypage-design.md §5`) ③ pullim-api CORS/쿠키 설정 ④ env `NEXT_PUBLIC_PULLIM_API`.

## 10. 범위 밖 / 리스크
- 범위 밖: 실연동·실 AI·결과 영속·소셜·결제·본인인증.
- 리스크: mock과 실 pullim-api **DTO 불일치** → `AuthAdapter` 타입을 `/me`·signup DTO에 최대한 맞춰 위험 최소화. mock 보안(비번 평문) 금지 — 세션 토큰만 보관, 비번 비저장.
- 리스크: 가입 필수 게이팅으로 첫 체험 마찰 → 랜딩 결과 예시로 보완(기보유).
