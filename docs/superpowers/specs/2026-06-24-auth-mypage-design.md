# 설계 — 인증 + 마이페이지 (pullim-api 연동, v1)

- 일자: 2026-06-24
- 대상: `apps/web` (입시 코치 프론트) + `pullim-api`(공용 인증 백엔드) 연동
- **기반(base): 5-deep 기능 체인(#30/#29/#31/#32/#33) + PUDS(#34)가 main에 머지된 *clean main*.** 본 설계는 지금 작성, 구현은 머지 후.
- 상태: 설계 확정 대기

---

## 1. 배경 / 문제
입시 코치는 현재 **로그인 없이** 제출→결과까지 가는 프로토타입이다. 사용자(가입·신원·미성년 동의·저장)가 없어 실서비스가 불가하다. 별도 레포 **`pullim-api`(NestJS 공용 백엔드)** 에 인증·계정이 이미 구현돼 있다:
- 세션: **httpOnly 쿠키(access+refresh) + CSRF double-submit + JWT**. env 파생 Secure/Domain.
- 가입/로그인: `POST /auth/signup`(+`/auth/signup/guardian-consent`), `/auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/csrf`, `/auth/email-verification/send|verify`, OAuth(카카오·구글·네이버·애플), guest 토큰. (계정 조회·탈퇴는 `/auth` 밖: `GET /me`, `POST /account/delete`.)
- 계정: `GET /me`(sub·email·displayName·ageBand[under14/over14/unknown]·package·tier·globalRole), `/me/entitlements`, `/me/children`, `POST /account/delete`(+cancel).
- **미성년 보호자 동의 전용 시스템**(GuardianConsentSignup·GuardianPiiMasking·동의 로그·PII sweep).
- **없는 것**: 입시 진단/생기부/결과 저장 모듈 → 본 작업 범위 밖(하위프로젝트 3).

본 하위 프로젝트는 입시웹을 pullim-api 인증과 연동해 **가입·로그인·세션·마이페이지(계정 중심)** 를 제공한다.

## 2. 목표 / 비목표
**목표**
- 진단 전 **가입·로그인 필수** 게이팅. 이메일+비번+인증메일+미성년 보호자 동의로 가입.
- 세션 유지 + 보호 라우트. 계정 중심 **마이페이지**(프로필·요금제·동의 상태·로그아웃·탈퇴).
- pullim-api와 **직접 호출(CORS+credentials)** 연동.

**비목표 (후속/별 하위프로젝트)**
- 소셜 OAuth(카카오 등) — 후속 v2.
- **진단 이력 저장·표시** — 결과 저장소(하위프로젝트 3) 필요. v1은 "곧" placeholder.
- 실 AI 진단 생성 — 하위프로젝트 3.
- KCB 본인인증, 결제·요금제 변경(표시만).

## 3. 결정 사항 (브레인스토밍 확정)
| # | 결정 | 선택 |
|---|---|---|
| 기반 | 체인+PUDS 머지 후 clean main | 확정 |
| 게이팅 | 진단 전 가입 필수 | 확정 |
| 수단 | 이메일+비번+인증메일+미성년 보호자 동의 (소셜 후속) | 확정 |
| 마이페이지 | 계정 중심, 진단 이력은 placeholder | 확정 |
| 연동 | 직접 호출(CORS+credentials), 클라이언트 가드 | 확정 |
| 미성년 | 계정 동의 1회 + 제출 동의 분리 | 확정 |

## 4. 아키텍처
- **`lib/api.ts` — API 클라이언트**: 단일 fetch 래퍼.
  - 베이스 URL = `process.env.NEXT_PUBLIC_PULLIM_API` (예 dev `http://localhost:3000`).
  - 모든 요청 `credentials: 'include'`.
  - **CSRF**: 변경 요청(POST/PATCH/DELETE)에 `X-CSRF-Token` 헤더로 토큰을 echo한다.
    토큰 획득 방식은 **쿠키 도메인 전략에 종속**된다(§10 선행조건과 함께 확정):
    - 인증/CSRF 쿠키가 **api 호스트 전용**이면 웹 앱 도메인의 JS는 그 쿠키를 읽을 수
      없으므로 echo가 불가능하다. 이 경우 **`GET /auth/csrf`가 응답 *본문*으로 토큰을
      반환**하고(또는 웹이 읽을 수 있는 비-httpOnly 쿠키) 클라이언트가 메모리에 두고 echo한다.
    - 또는 **공유 부모 도메인 쿠키**(`Domain=.pullim…`)로 두어 웹·api 서브도메인이 같은
      CSRF 쿠키를 읽게 한다.
    어느 쪽이든 "웹 JS가 echo할 토큰을 얻을 수 있어야" 한다 — api-호스트-전용 httpOnly
    쿠키만으로는 CSRF 부트스트랩이 동작하지 않는다. 플랜 단계에서 pullim-api의 실제
    `/auth/csrf` 응답 형태와 쿠키 도메인을 확인해 확정한다.
  - **401 처리**: `POST /auth/refresh` 1회 시도 후 원요청 재시도. 실패 시 인증 만료로 처리(로그아웃 상태 + `/login?next=` 유도).
  - 표준 에러 형태로 정규화(필드 에러/일반 에러 구분).
- **`components/auth-provider.tsx`('use client')**: 앱 마운트 시 `GET /me`로 세션 하이드레이트.
  - 노출: `user`(MeResponse | null), `status`('loading'|'authed'|'guest'), `login()`, `signup()`, `logout()`, `refreshMe()`.
  - `app/layout.tsx`에서 `AppShell`을 감싸 전역 제공.
- **라우트 보호 = 클라이언트 가드**(`RequireAuth` 래퍼 또는 보호 페이지 상단 훅). 직접 호출이라 인증 쿠키가 **api 도메인** 소속 → Next 미들웨어가 못 읽으므로 서버 미들웨어 가드는 쓰지 않는다. `status==='guest'`면 `/login?next=<path>`로 리다이렉트. **실제 강제는 pullim-api가 매 요청 인증을 검증**하므로 안전(클라 가드는 UX 목적).

## 5. 페이지 · 엔드포인트 매핑
| 화면 | 동작 | pullim-api |
|---|---|---|
| `/signup` | 이메일·비번·이름·생년월일 입력 → 가입. 미성년이면 보호자 동의 단계. | `POST /auth/signup` · `POST /auth/signup/guardian-consent` |
| 이메일 인증(가입 내 단계 또는 `/verify-email`) | 인증코드 발송/확인 | `POST /auth/email-verification/send` · `/verify` |
| `/login` | 이메일·비번 로그인 | `POST /auth/login` · `GET /auth/csrf`(부트스트랩) |
| `/mypage` | 프로필·연령대·요금제·미성년 동의 상태 표시 · 로그아웃 · 회원탈퇴 | `GET /me` · `GET /me/entitlements` · `POST /auth/logout` · `POST /account/delete`(+`/delete/cancel`) |
| 전역 상단바(actions) | 로그인 시 이름+마이페이지+로그아웃 / 비로그인 시 로그인·가입 | `GET /me` |

- **미성년(만 19세 미만) 판정 = `isMinor`** 가 권위. **`ageBand`(`under14`/`over14`)와 혼동 금지** —
  `ageBand`는 *만 14세* 경계(개인정보 동의 경계)이고, 보호자 동의/가드 분기는 *만 19세* 경계인
  `isMinor`로 한다. `ageBand`만 신뢰해 미성년 분기를 하면 14~18세가 성인으로 처리되어 보호자
  동의가 누락된다. (이 저장소 타입: `apps/web/lib/auth/types.ts` — `AgeBand='under14'|'over14'|'unknown'`,
  `isMinor: boolean` 별도. `isMinorByBirth`=만19, `ageBandFromBirth`=만14.) 서버 응답에 `isMinor`가
  없으면 pullim-api가 만19 기준 미성년 플래그를 제공하도록 **플랜에서 게이트**한다(클라 생년월일
  판정은 UX 분기 보조용).
- **보호 라우트**: `/submit`·`/consent`·`/processing`·`/result`·`/mypage` → 미로그인 시 `/login?next=`. **공개**: `/`·`/login`·`/signup`·`/verify-email`.
- **`next` 오픈 리다이렉트 가드(필수):** `/login?next=`·`/signup?next=`의 `next`는 **내부 경로만** 허용한다 — `/`로 시작하고 `//`(프로토콜-상대)·`http(s):`·역참조가 아닌 값만. 검증 실패 시 기본값(`/mypage`)으로 폴백. 현재 코드(`app/login/page.tsx`·`app/signup/page.tsx`)는 `searchParams.get('next')`를 검증 없이 push하므로 외부 URL 주입이 가능 → B 연동 시 함께 가드 추가할 것. 예: `const safe = next?.startsWith('/') && !next.startsWith('//') ? next : '/mypage'`.
- 랜딩 CTA("생기부 업로드 시작") → 미로그인 시 `/signup`으로, 로그인 시 `/submit`으로.

> 정확한 요청/응답 DTO(필드명·필수·검증)는 **플랜 단계에서 pullim-api Swagger(`/api-docs`)와 DTO 파일**(`signup-request.dto`, `login-request.dto`, `me-response.dto` 등)로 확정해 코드에 반영한다.

## 6. 미성년 보호자 동의 정리
- **계정 가입 시 = 법적 보호자 동의 1회**(pullim-api `guardian-consent`, prod 카카오 알림톡 확인). 신원·연령 권위는 pullim-api.
- **제출별 `/consent`(=#17 체인) = 개인정보 수집·이용 동의**(이번 제출 데이터에 한정). 여기의 "미성년 법정대리인 동의" 체크는 **계정에서 이미 완료된 보호자 동의를 참조**하도록 바꿔 중복 제거.
- `/consent`는 #17 체인 소속 → **체인 머지 후** 본 작업에서 조율(계정 동의 상태를 읽어 제출 동의 화면 분기).

## 7. 데이터 / 세션 흐름
1. 비로그인 사용자가 보호 라우트 진입 → `/login?next=`.
2. 가입: `/signup` → (인증메일) → 미성년이면 보호자 동의 → 세션 쿠키 발급(`Set-Cookie` access/refresh/csrf).
3. 이후 모든 요청 `credentials:'include'` + CSRF echo. 페이지 로드마다 `GET /me`로 하이드레이트.
4. access 만료 → `/auth/refresh`로 슬라이드. refresh 만료 → 로그아웃 상태.

## 8. 에러 처리
- 401 → refresh→재시도→실패 시 `/login`.
- CSRF 403 → `/auth/csrf` 재부트스트랩 후 1회 재시도.
- 가입: 이메일 중복·약한 비번·인증코드 만료/불일치 → 인라인 필드 에러.
- 미성년: 보호자 동의 미완료 → 진단 진입 차단 + 안내.
- 네트워크/서버 다운 → 친절 메시지 + 재시도. (pullim-api 미가동 시 명확한 안내.)

## 9. 테스트
- **vitest**: `lib/api.ts` — CSRF echo, 401→refresh→재시도, 에러 정규화(fetch mock).
- **수동 e2e**: 가입→인증메일→로그인→마이페이지→로그아웃→탈퇴 · 미성년 가입→보호자 동의 · 보호 라우트 리다이렉트 · 세션 만료 재로그인.
- typecheck + `next build`.

## 10. 선행조건 / 조율 (pullim-api 측)
1. **CORS 허용**: 입시웹 origin(dev `http://localhost:3030`, prod 도메인)을 credentials 허용 목록에 추가.
2. **쿠키 Domain/SameSite**: 크로스오리진 세션 동작(prod `SameSite=None; Secure` 또는 공유 부모 도메인 `Domain=.pullim...`). dev는 localhost 동일 사이트(다른 포트)로 동작.
3. **pullim-api 가동** + 베이스 URL 환경변수.
4. **DTO·플로우 확정**: signup/login/email-verification/guardian-consent의 요청·응답 스키마를 Swagger로 확인.
> 이 항목들이 충족되지 않으면 연동이 동작하지 않으므로, 구현 첫 태스크에서 게이트한다.

## 11. 범위 밖 (후속)
소셜 OAuth · 진단 이력 저장·표시(하위프로젝트 3) · 실 AI 결과(3) · KCB 본인인증 · 비밀번호 재설정(원하면 v1.1) · 결제·요금제 변경.

## 12. 리스크
- pullim-api **CORS/쿠키 미설정** 시 연동 불가 → 선행조건 게이트.
- 직접 호출 + httpOnly 쿠키 → Next 서버 미들웨어 가드 불가 → 클라 가드(소프트). 보호는 pullim-api 서버 검증에 의존(설계상 안전).
- **가입 필수 게이팅**으로 첫 체험 마찰 ↑ → 랜딩에서 가치(결과 예시) 충분히 보여줘 전환 보완(랜딩은 이미 예시 미리보기 보유).
- 미성년 동의 **이중화**(계정 vs 제출) → §6 정리로 단일화, #17 체인 머지 후 조율.
- 본 작업은 **clean main 의존** — 체인+PUDS 미머지 시 시작 불가.
