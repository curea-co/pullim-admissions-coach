# pullim-api 선행조건 체크리스트 — CORS · 쿠키 · CSRF

- 목적: 입시웹(`apps/web`)을 `pullim-api`(NestJS)와 연동하기 전 **백엔드 쪽에서** 맞춰야 하는 설정. 여기가 안 맞으면 연동이 동작하지 않는다(가장 흔한 함정).
- 대상 독자: pullim-api를 만지는 사람(대표 직접 또는 백엔드 담당).
- 짝 문서: `docs/superpowers/specs/2026-06-24-auth-mypage-design.md`(§4·§10), `docs/RELEASE-HANDOFF.md` §3.1.
- 전제: 입시웹 전송 계층은 `apps/web/lib/api.ts`로 이미 구현됨(아래 동작에 맞춰 백엔드 설정).

## 입시웹이 실제로 보내는 요청 (이 동작에 맞춰 설정)
- 모든 요청 `credentials: 'include'` (쿠키 세션 동반)
- 변경 요청(POST/PATCH/DELETE)에 **`X-CSRF-Token`** 헤더 echo
- 최초 변경 전 **`GET /auth/csrf`** 호출 → **응답 본문 `{ csrfToken }`** 에서 토큰 읽음
- 401 응답 시 **`POST /auth/refresh`** 1회 후 원요청 재시도
- 오리진: dev `http://localhost:3030`, 프로덕션 `https://<web-domain>`

---

## A. CORS (NestJS `main.ts`)
- [ ] **허용 오리진에 입시웹 추가**: dev `http://localhost:3030`, 프로덕션 웹 도메인. (와일드카드 `*` 금지 — credentials와 동시 사용 불가)
- [ ] **`credentials: true`** (쿠키 주고받기)
- [ ] **`allowedHeaders`에 `Content-Type`, `X-CSRF-Token` 포함** (없으면 프리플라이트 실패)
- [ ] **`methods`**: `GET, POST, PATCH, DELETE, OPTIONS`
- [ ] (필요 시) `exposedHeaders` 설정

```ts
// pullim-api / main.ts
app.enableCors({
  origin: [
    'http://localhost:3030',           // dev 입시웹
    'https://app.pullim.ai',           // 프로덕션 웹 도메인(실제 값으로)
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
});
```
- [ ] **검증**: 프리플라이트가 200/204 + `Access-Control-Allow-Credentials: true` + 오리진 echo 하는지
```bash
curl -i -X OPTIONS http://localhost:3000/auth/login \
  -H "Origin: http://localhost:3030" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,x-csrf-token"
# 기대: Access-Control-Allow-Origin: http://localhost:3030 / Allow-Credentials: true / Allow-Headers에 x-csrf-token
```

---

## B. 쿠키 (세션: access · refresh · csrf)
- [ ] **access/refresh 쿠키 `httpOnly`** (JS 접근 차단)
- [ ] **`SameSite` / `Secure`를 환경에 맞게**(아래 표) — 이게 틀리면 쿠키가 *전송 안 되거나 저장 안 됨*
- [ ] **dev에서 `Secure` 켜지 말 것**(http라 쿠키가 버려짐)

| 환경 | 웹 ↔ api 관계 | 쿠키 설정 |
|---|---|---|
| **dev** | `localhost:3030` ↔ `localhost:3000` (포트만 다름=동일 사이트) | `SameSite=Lax`, **Secure 끔**, Domain 미지정 |
| **prod, 같은 부모 도메인** | `app.pullim.ai` ↔ `api.pullim.ai` | `SameSite=Lax; Secure; Domain=.pullim.ai` |
| **prod, 완전 다른 도메인** | `coach.com` ↔ `api.pullim.ai` (교차 사이트) | **`SameSite=None; Secure`** (필수) |

> 쿠키는 포트가 아니라 **호스트** 기준이라 dev에서 localhost:3000이 설정한 쿠키가 localhost:3030 요청에 실린다(동일 사이트). 그래서 dev는 `Lax`로 충분.

- [ ] **검증**: 로그인 응답에 `Set-Cookie`(access/refresh/csrf)가 위 속성으로 내려오는지(브라우저 DevTools → Application → Cookies, 또는 `curl -i`)

---

## C. CSRF
입시웹은 **`GET /auth/csrf` 응답 본문의 `{ csrfToken }`** 을 읽어 변경 요청에 `X-CSRF-Token`으로 echo한다(설계 §4: api-호스트 전용 httpOnly 쿠키면 JS가 못 읽으므로 본문 토큰이 안전).

- [ ] **`GET /auth/csrf`가 토큰을 *응답 본문*으로 반환**: `{ "csrfToken": "..." }`
  - 만약 pullim-api가 **읽기 가능한 쿠키(double-submit)** 방식이면, 입시웹 `lib/api.ts`의 `bootstrapCsrf()`를 그 쿠키를 읽도록 수정(주석에 안내됨). **둘 중 하나로 합의.**
- [ ] **일반 변경 요청(POST/PATCH/DELETE)에서 `X-CSRF-Token` 헤더 검증**(double-submit/세션 토큰 일치). 입시웹은 이들 요청 전 `bootstrapCsrf()`로 토큰을 확보해 echo한다.
- [ ] **`/auth/refresh`의 CSRF 정책 합의** ⚠️ — 입시웹 `refreshOnce()`는 401 자동 갱신 시 **메모리에 토큰이 있을 때만** `X-CSRF-Token`을 보낸다(`lib/api.ts`). 즉 첫 액션이 곧바로 refresh로 가는 경로에선 **토큰 없이** 갈 수 있다. 따라서 둘 중 하나로:
  - (권장) **`/auth/refresh`는 CSRF 면제** — refresh는 httpOnly refresh 쿠키로 인증하므로 CSRF 미요구가 일반적. 또는
  - refresh에도 CSRF를 요구한다면, 입시웹이 refresh 전 CSRF를 항상 부트스트랩하도록 `lib/api.ts`를 수정해야 함(현재는 안 함).
- [ ] **GET 요청엔 CSRF 미요구**(부트스트랩 자체가 GET)
- [ ] **응답 본문 `{ csrfToken }` 키 이름 확정** → 다르면 `bootstrapCsrf()`의 `data.csrfToken` 부분을 그 키로 교정
- [ ] **검증**: `GET /auth/csrf` → 본문에 토큰 / 토큰 없이 POST → 403 / 올바른 `X-CSRF-Token`으로 POST → 통과

> 입시웹은 403을 받으면 자동으로 `/auth/csrf` 재부트스트랩 후 1회 재시도한다(`lib/api.ts`). 따라서 403 응답이 CSRF 불일치를 의미하도록 일관되게.

---

## D. 엔드포인트 존재 확인 (Swagger `/api-docs`)
입시웹 어댑터(`lib/auth/pullim-api-adapter.ts`)가 호출하는 경로/DTO가 실제와 맞는지:
- [ ] `POST /auth/signup` (+ `/auth/signup/guardian-consent`)
- [ ] `POST /auth/login` · `POST /auth/logout` · `POST /auth/refresh` · `GET /auth/csrf`
- [ ] `POST /auth/email-verification/verify`
- [ ] `GET /me` (필드: `sub`·`email`·`displayName`·`ageBand`·**`isMinor`**·`guardianConsent`)
- [ ] `GET /me/entitlements` (`package`·`tier`)
- [ ] `POST /account/delete`
- [ ] ⚠️ **미성년 판정은 `isMinor`(만19) 필드** — `ageBand`(만14)와 혼동 금지. `/me`에 `isMinor`가 없으면 추가 제공.
- [ ] 위 응답 DTO 필드명을 어댑터의 `TODO(B)`(7곳)에 반영.

---

## E. 입시웹 쪽 마무리 (백엔드 OK 이후)
- [ ] `apps/web/.env.local`에 **둘 다**:
  ```
  NEXT_PUBLIC_AUTH_BACKEND=pullim
  NEXT_PUBLIC_PULLIM_API=http://localhost:3000
  ```
- [ ] `lib/auth/pullim-api-adapter.ts`의 `TODO(B)` 필드명을 Swagger 기준으로 교정
- [ ] `just dev` → 실제 **가입 → 인증메일 → 로그인 → 마이페이지 → 로그아웃 → 탈퇴** e2e
- [ ] `pnpm --filter @pullim/web typecheck && test && build`

---

## 흔한 함정 (여기서 막히면 십중팔구 이것)
1. **CORS origin `*` + credentials** → 브라우저가 차단. 오리진을 명시 목록으로.
2. **`allowedHeaders`에 `X-CSRF-Token` 누락** → 프리플라이트(OPTIONS) 실패 → 모든 변경 요청 실패.
3. **dev에서 `Secure` 쿠키** → http라 쿠키 저장 안 됨 → 로그인해도 세션 유지 안 됨.
4. **prod 교차 도메인인데 `SameSite=Lax`** → 쿠키가 교차 사이트 요청에 안 실림 → 항상 401. → `None; Secure`.
5. **CSRF 토큰을 httpOnly 쿠키로만 줌** → 웹 JS가 못 읽어 echo 불가 → 항상 403. → 본문 토큰 또는 읽기 가능 쿠키.
6. **`/me`가 `isMinor` 미제공** → 14~18세가 성인 처리 → 보호자 동의 누락(법적 이슈).
