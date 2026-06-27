# 풀림 입시코치 — 출시 핸드오프 (7/1 베타)

- 작성: 2026-06-26
- 목적: 베타 출시(2026-07-01)까지 남은 작업을 **소유자별로** 정리하고, mock→실 **교체점**·시크릿·배포 노트를 한 곳에 모은 인수인계 문서.
- 대상 독자: CEO(의사결정) · 담당 직원(엔지니어) · 법무 · 인프라.

---

## 1. 한눈에 보기

**제품:** 학종(학생부종합전형) 생기부를 입력하면 AI가 3역량 진단 + 면접 준비 + 보완안 + 로드맵 + 적합도를 만들어 주는 입시 코치. §6 가드레일(정답/대본/합격답변 금지, 방향만 + 근거 인용) 준수.

**스택:** Next.js(App Router, apps/web) · pnpm 모노레포(packages/shared, packages/engine) · Tailwind v4 + PUDS 디자인 시스템 · Anthropic Claude(opus-4-8, server-only) · NestJS 공용 백엔드 `pullim-api`(별 레포, 인증).

### 상태 요약
- ✅ **main에 통합 완료** — PUDS·OS 대시보드·랜딩 · mock 인증+마이페이지 · 학생 경험(자기답변·저장/공유) · #24 학년별 제도 · #23 무전공 · #28 접근성 · #17 PII 검출/마스킹 · #19 3역량 진단 · #20 보완안 · #22 면접 분기 · #25 결과 입력 반영.
- ✅ **실 AI 진단 파이프라인 + 남용 가드 머지됨(PR #37)** — #16 풀 포팅. live 검증(실 키 e2e: demo:false, §6 위반 0, 마스킹 0 누출, 429 동작) + 코덱스 리뷰 5사이클 대응 후 main 통합. `lib/ai`·`packages/engine`·`lib/rate-limit`.
- 🔲 **출시 전 P0 (아래 §2)** — 대부분 직원/법무/인프라 결정 대기.

---

## 2. 출시 전 P0 체크리스트

| # | 항목 | 상태 | 소유자 | 선행/차단 | 참고 |
|---|---|---|---|---|---|
| 1 | 실 AI 파이프라인 + 남용 가드 | ✅ **머지됨(PR #37)** | — | — | main 통합 완료. lib/ai·packages/engine·lib/rate-limit |
| 2 | **#18 API 키 재회전** | 🔲 | **CEO** | — | 테스트 키가 대화에 노출됨 → 폐기·재발급, 호스팅 시크릿에만 |
| 3 | **배포(키·maxDuration tier·시크릿·도메인)** | 🔲 | **인프라** | 호스팅 결정 | §4, §5. 프로덕션은 `RATE_LIMIT_IP_HEADER`·`RATE_LIMIT_BACKEND`도 필요(없으면 fail-closed) |
| 4 | **B. 실 인증(pullim-api 연동)** | 🔲 | **직원** | pullim-api CORS/쿠키 설정 | §3.1, [auth 설계](superpowers/specs/2026-06-24-auth-mypage-design.md) |
| 5 | **C. 결과 영속(DB)** | 🔲 | **직원** | 백엔드 결과 저장 모듈 | §3.2 — 현재 sessionStorage |
| 6 | **레이트리밋 KV 전환** | 🔲 | **직원/인프라** | Upstash/Vercel KV | §3.3 — 현재 in-memory(인스턴스별) |
| 7 | **잡큐(24h SLA·타임아웃 해소)** | 🔲 | **직원/인프라** | — | §5 — 동기 호출 한도 초과 대비, 프로덕션 정답 |
| 8 | **약관/개인정보/미성년 동의 문구** | 🔲 | **법무** | — | §6 |

> **출시 단계 구분(중요):**
> - **2(#18 키) + 3(배포)** = "실 AI가 도는 **내부/통제 데모**"만 가능. **공개 베타 아님.**
> - **공개 베타(실사용자·미성년 계정 수용)는 4(실 인증 B) + 5(결과 영속 C, 사용자 스코프) + 8(약관) 선행 필수.** mock 인증은 비밀번호 평문 `localStorage` 저장이고, `result-store.ts`는 사용자 스코프 없이 `localStorage`에 이력을 둬 공용 브라우저 교차사용자 노출이 있으므로, **그대로 공개 사용자에게 노출하면 안 된다.**

> ⚠️ **알려진 보안 부채(공개 전 해소):** (a) mock 인증 평문 비밀번호[#4=B], (b) `result-store.ts`가 사용자 스코프 없이 `localStorage`에 자기답변·이력 저장 → 공용 브라우저에서 **다른 로그인 사용자에게 이전 사용자 데이터 노출**[#5=C], (c) `/login?next=` 미검증 오픈 리다이렉트(§3.1 가드 규칙).

---

## 3. mock → 실 교체점 (직원 착수 가이드)

코드베이스는 **단일 교체점 패턴**(AuthAdapter처럼)으로 설계되어, 각 항목을 한 파일에서 바꾸면 끝난다.

### 3.1 인증 — `apps/web/lib/auth/index.ts`
**명시 옵트인** 게이트(코드 수정 없이 env로 전환):
```ts
const usePullimApi = process.env.NEXT_PUBLIC_AUTH_BACKEND === 'pullim';
export const auth = usePullimApi ? pullimApiAuthAdapter : mockAuthAdapter;
```
실 전환은 **env 두 개**: `NEXT_PUBLIC_AUTH_BACKEND=pullim` + `NEXT_PUBLIC_PULLIM_API=<url>`.
URL만 있고 플래그가 없으면 mock 유지(실수 주입으로 미완성 어댑터가 켜지는 것 방지).
- 현재: `mockAuthAdapter`(localStorage 기반, 데모용).
- 목표: `pullim-api`(NestJS) 직접 호출(CORS + httpOnly 쿠키 + CSRF + JWT).
- **설계 전부**: [docs/superpowers/specs/2026-06-24-auth-mypage-design.md](superpowers/specs/2026-06-24-auth-mypage-design.md)
  - 엔드포인트 매핑(`POST /auth/signup`·`/auth/login`·`/auth/refresh`, 계정은 `/auth` 밖 `GET /me`·`POST /account/delete` …), CSRF echo, 401→refresh→재시도, 미성년 보호자 동의, 보호 라우트, **pullim-api 선행조건(CORS·쿠키 Domain/SameSite·Swagger DTO 확정)**.
- **pullim-api 선행조건 체크리스트(백엔드 설정)**: [docs/pullim-api-prereqs-checklist.md](pullim-api-prereqs-checklist.md) — CORS·쿠키·CSRF·엔드포인트 NestJS 설정 + 검증 + 함정.
- `AuthAdapter` 인터페이스: `apps/web/lib/auth/types.ts`. 같은 시그니처로 실 어댑터 구현 후 한 줄 교체.
- ⚠️ **오픈 리다이렉트 가드(B 연동 시 필수):** `/login?next=`·`/signup?next=`의 `next`를 **내부 경로만** 허용하도록 검증(현재 코드는 미검증). 규칙은 [auth 설계 §5](superpowers/specs/2026-06-24-auth-mypage-design.md) 참조.

### 3.2 결과 영속 — sessionStorage → DB
- 현재: `apps/web/lib/result-view.ts`(`saveAnalyzeResult`/`loadAnalyzeResult`, **sessionStorage**, 탭 수명), `apps/web/lib/result-store.ts`(자기답변·저장 이력, **localStorage**, mock).
- ⚠️ **알려진 위험:** `result-store.ts`는 **사용자 스코프 없이 localStorage**에 저장 → 같은 브라우저에서 다른 사용자가 로그인하면 **이전 사용자의 자기답변·이력이 노출**된다. 공개 전 반드시 사용자 스코프(또는 로그아웃 시 삭제) + 서버 저장으로 전환.
- 목표: pullim-api(또는 입시 전용 백엔드)에 결과 저장·조회·삭제. 마이페이지 진단 이력이 실제 저장분(사용자 스코프)을 읽도록.
- 비고: 이건 **백엔드 결과 저장 모듈**(auth 설계의 "하위프로젝트 3")이 선행. §6 정직 라벨(데모 플래그)·삭제권(개인정보) 유지할 것.

### 3.3 레이트리밋 — `apps/web/lib/rate-limit/index.ts`
현재 export는 한 줄 swap이 아니라 `selectLimiter()`로 감싸 **프로덕션에서 `RATE_LIMIT_BACKEND` 미설정 시 fail-closed**(첫 호출 throw)하도록 되어 있다. KV 전환은 `selectLimiter()` 안에서 한다:
```ts
function selectLimiter(): RateLimiter {
  // KV 도입 시: return createKvRateLimiter();  ← 여기서 교체
  if (process.env.NODE_ENV === 'production' && process.env.RATE_LIMIT_BACKEND !== 'memory') {
    throw new Error('레이트리밋 백엔드 미구성(프로덕션 fail-closed)…');
  }
  return createMemoryRateLimiter();
}
// rateLimiter는 첫 check()에서 selectLimiter()를 1회 평가(지연) → next build(NODE_ENV=production) 무해.
export const rateLimiter: RateLimiter = { check(key, rules) { /* lazy init */ } };
```
- 현재: in-memory 슬라이딩 윈도우(단일 프로세스/웜 람다 내에서만 공유 → 서버리스 다중 인스턴스에선 인스턴스별 카운트). 프로덕션은 `RATE_LIMIT_BACKEND=memory` 명시 옵트인 없이는 fail-closed.
- 목표: Upstash Redis / Vercel KV 어댑터(`RateLimiter` 인터페이스는 `types.ts` 그대로 구현)를 `selectLimiter()`에서 반환.
- 규칙·상한은 같은 파일 상단: `ANALYZE_RATE_RULES`(버스트 3/분, 일일 10/일), `MAX_SAENGBU_CHARS`(5만 자). 운영하며 조정.

---

## 4. 시크릿 / 환경변수

| 변수 | 용도 | 어디에 | 비고 |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | 실 AI 진단(server-only) | `apps/web/.env.local`(로컬) · **호스팅 시크릿**(배포) | **NEXT_PUBLIC 아님.** 없으면 dev는 mock 데모, **프로덕션은 503(fail-loud)** |
| `RATE_LIMIT_IP_HEADER` | 레이트리밋 신뢰 IP 헤더 | 호스팅 env | **프로덕션 필수**(미설정 시 fail-closed). 엣지/프록시가 위조 불가하게 덮어쓰는 헤더만(예 Vercel `x-forwarded-for`) |
| `RATE_LIMIT_BACKEND` | in-memory 명시 옵트인 | 호스팅 env | **프로덕션**에서 KV 어댑터 없이 in-memory 쓰려면 `memory` 명시(없으면 fail-closed). KV 도입 시 불필요 |
| `ALLOW_DEMO_FALLBACK` | 프로덕션 데모 허용 | 호스팅 env | 선택. 스테이징 등에서 키 없이 데모 보려면 `1`. 기본은 프로덕션 503 |
| `NEXT_PUBLIC_AUTH_BACKEND` | 실 인증 명시 옵트인 (B) | env | `pullim` 이면 실 어댑터. 없으면 mock. URL만으론 전환 안 됨 |
| `NEXT_PUBLIC_PULLIM_API` | pullim-api 베이스 URL (B 연동) | env | dev 예: `http://localhost:3000`. 위 플래그와 **함께** 설정 |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | 레이트리밋 KV (배포) | 호스팅 시크릿 | KV 전환 시 추가 |

- `.env.local`은 gitignore됨. 예시: `apps/web/.env.local.example`.
- **시크릿을 git/iCloud/대화에 절대 올리지 말 것.** 노출되면 즉시 회전.

---

## 5. 배포 노트

- **모노레포 빌드**: `pnpm --filter @pullim/web build`. 워크스페이스 `packages/shared`·`packages/engine` 포함.
- **함수 타임아웃**: `/api/analyze`는 opus 풀 파이프라인(3~4콜 ≈ 30~90초)이라 `maxDuration=300` 설정. **Vercel Hobby는 60초로 클램프 → Pro/Fluid 필요.** twin 경로 등으로 초과 위험 → **프로덕션 정답은 동기 호출이 아닌 잡큐**(BullMQ 등). 베타는 동기 + 타임아웃 안내로 시작.
- **남용 가드**: §3.3 — 인증 전 공개 엔드포인트라 IP 레이트리밋 + 입력 길이 가드 적용됨. 배포 시 KV로 전환해야 다중 인스턴스에서 정확.
- **키 회전 절차**: Anthropic 콘솔에서 발급 → 호스팅 시크릿에 주입 → 이전 키 폐기. 절대 코드/PR/대화에 평문 금지.

---

## 6. 법무 / 약관 (법무 소유)

- 이용약관 · 개인정보 수집·이용 동의 · **미성년 법정대리인 동의** 문구.
- 현재: 계정 가입 시 보호자 동의(1회) + 제출별 `/consent`(개인정보 수집·이용) 2층 구조. B 연동 시 계정 동의를 참조해 제출 동의 중복 제거(auth 설계 §6).
- §6 가드레일(정답/대본/합격답변 금지)은 카피 SSOT(`apps/web/lib/guardrail-copy.ts`)로 관리 — 법무 문구도 여기 일관.
- SSOT 문서(prompt/golden/definition/dataset) 변경은 **EPO(최선혜) 검토** 후 머지.

---

## 7. 알려진 후속(deferred) · 비목표

- **인증 v2**: 소셜 OAuth(카카오·구글·네이버·애플), KCB 본인인증, 비밀번호 재설정.
- **결제/요금제 변경**: 현재 표시만(mock).
- **마이페이지 진단 이력**: B+C 이후 실제 저장분 연결("다시 보기"가 `/result?id=`로 라우팅되도록).
- **알림**: 결과 완료 SES/카카오 알림톡(잡큐와 함께).
- 구현 세부·태스크별 결정 이력은 각 기능의 PR(설명·코덱스 리뷰 스레드)과 커밋 메시지를 참조(예: 실 AI는 PR #37).

---

## 8. 참고 문서 인덱스

- 실 AI 파이프라인: [설계 spec](superpowers/specs/2026-06-26-real-ai-pipeline-design.md) (구현·검증 이력은 PR #37)
- 인증+마이페이지(실 연동): [specs](superpowers/specs/2026-06-24-auth-mypage-design.md) · mock: [specs](superpowers/specs/2026-06-24-auth-mypage-mock-design.md)
- 3역량 진단 · PII · 면접 분기 · 결과 반영 · 보완안 · PUDS · 학생 경험: `docs/superpowers/specs/` 참조.
- 정의/프롬프트/골든/스키마 SSOT: `docs/002_…definition`, `docs/prompt_v0.1.md`, `docs/golden/`, `docs/student_profile_schema_v0.1.json`.
