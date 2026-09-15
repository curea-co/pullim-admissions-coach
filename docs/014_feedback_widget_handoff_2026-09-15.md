# 건의하기 창구 — 인수인계 (2026-09-15)

> **다음 세션이 읽을 문서.** 코드는 네 저장소에서 전부 준비됐고, **막혀 있는 것은 마이그레이션 실행 경로 하나뿐**이다.
> 관련: `012_policy_v2_screen_and_backend_plan_v0.1.md` · `013_admissions_BE_P0_design_v0.1.md`

---

## 1. 지금 어디까지 왔나

| 저장소 | 산출물 | 상태 |
| --- | --- | --- |
| pullim-admissions-coach | 위젯(FAB + 모달) | **dev 배포 완료** — `de061a9`(#76), 버튼 실제로 보임 |
| pullim-admissions-coach | 전송 경로 → pullim-api | PR **#78 APPROVED**, 미머지 |
| pullim-api | `src/feedback/` 모듈 | PR **#644 APPROVED**, 미머지 |
| pullim-admin | 건의 관리 콘솔 | PR **#60 APPROVED · CLEAN**, 미머지 |

**사용자가 현재 볼 수 있는 것**: `dev-admissions.pullim.ai` 우하단 "건의하기" 버튼 → 모달까지. **보내기는 실패한다**(저장할 곳 미배포 → 정직한 오류 표시). 설계대로다.

### 각 PR 이 실제로 하는 일

**#76 (머지·배포됨) — 화면을 만든다.**
우하단 버튼(쉴 때 원형, 호버 시 "건의하기" 알약으로 확장)과 모달(카테고리 드롭다운 + 내용). 이때 만든 서버 라우트 `POST /api/feedback` 은 받은 내용을 **Slack 웹훅으로 던지고 끝**이었다 — 어디에도 저장하지 않는다.

**#78 — 그 던지는 대상을 pullim-api 로 바꾼다.** ← 이게 "관리자에게 도달한다"를 실제로 만드는 PR
- Slack 웹훅 전달 → `POST {PULLIM_API_URL}/feedback` + `x-service-key`. api 가 DB 에 저장하고, 그래야 admin 콘솔 목록에 뜬다.
- 곁들여: **맥락 수집**(경로·브라우저·뷰포트·앱 버전 — 버그 재현에 필요) + **작성자 판별을 서버에서**(브라우저가 보낸 id 를 믿으면 위조된다. 쿠키로 서버가 확인해 채운다).
- 변경 1,836줄인데 기능이 커서가 아니다 — 파일 14개 중 **7개가 테스트**, 나머지 상당수가 방어 코드다. 서버가 외부 주소로 요청을 보내는 구조라 리뷰가 15라운드 돌았고, 그 과정에서 **실제 취약점**이 하나 잡혔다(주소를 문자열로 이어 붙이던 곳에 `//evil.example/x` 가 들어오면 **엉뚱한 호스트로 요청이 나갔다**).
- ⚠ **지금 머지하면 안 된다.** 보낼 대상인 api 가 미배포라, 머지하면 Slack 경로는 끊기고 새 경로는 받을 곳이 없어 **지금보다 나빠진다.**
- 웹훅 코드(`webhook-target.ts`·`webhook-post.ts`)는 **지우지 않았다** — SSRF 방어가 담겨 있어 새 경로가 재사용한다.

**#644 (pullim-api) — 받아서 저장하고, 관리자에게 보여줄 API 를 만든다.**
`src/feedback/` 신설(15번째 서비스 경계). 수집 `POST /feedback`(서비스 키) + 관리 `GET /admin/feedbacks`·`/meta`·`/:id`·`PATCH /:id`. 테이블 2개(건의 + 상태 이력)와 마이그레이션 1개.

**#60 (pullim-admin) — 그 API 를 읽는 화면을 만든다.**
좌측 메뉴 "건의 관리" + 목록(상태 칩·필터 5종·`FB-YYYY-NNNN`)·상세(본문·제출 환경·상태 이력·상태 변경·담당자·메모·답변). api 미배포라 **픽스처로 돌려 검증**했다(`NEXT_PUBLIC_FEEDBACKS_FIXTURES=1`).

**한 줄 요약**: #76 이 입구, **#78 이 배관**, #644 가 저장소, #60 이 출구다. 배관만 연결돼 있지 않다.

---

## 2. 🔴 단 하나의 블로커 — 마이그레이션 실행 경로

`pnpm migration:run`(pullim-api)을 **돌릴 위치가 정해지지 않았다.**

- ADR-041: **"배포≠마이그레이션(수동 bastion 유지)"** — dev 는 머지 시 ECS 자동배포지만 마이그레이션은 사람이 돌린다.
- `scripts/migration.sh` 주석: CLI 마이그레이션은 **호스트에서 직접** 실행(컨테이너 아님).
- RDS 전부 `PubliclyAccessible: False`. `pullim-api-dev` 는 `vpc-0b3ca38f9c17f994f`.
- SSM 으로 닿는 인스턴스는 `curea-runner`(i-0a028b4991733dbf7) 하나인데 **VPC 가 다르다**(`vpc-074fe0ee810cad71d`) — 피어링 없으면 DB 에 못 닿고, 그건 CI 러너지 배스천도 아니다.
- AWS CLI 자체는 이 머신에서 `user/psh` 로 인증돼 있다(조회 가능). 막힌 것은 **권한이 아니라 네트워크 경로**다.

**→ 다음 세션이 먼저 할 일: 오너에게 "이 마이그레이션을 평소 어디서 돌리는지" 확인.** 경로가 확보되기 전에 #644 를 머지하면 dev 에 자동배포되고 **테이블이 없어 `/feedback` 이 500 으로 깨진다.**

---

## 3. 배포 순서 (순서를 지켜야 하는 이유까지)

1. **마이그레이션 경로 확보** ← 지금 여기
2. `pullim-api` **#644 머지** → dev 자동배포
3. **`pnpm migration:run` 실행** (2와 간극 최소화 — 그 사이 API 가 깨진다)
4. **`WEB_FEEDBACK` 서비스 키 발급·주입** (Action Gate)
5. `pullim-admissions-coach` env 4종 설정 → **#78 머지** → 배포
   - `PULLIM_API_URL` · `FEEDBACK_SERVICE_KEY` · `FEEDBACK_API_ALLOWED_HOSTS`(운영 필수, 미설정 시 501) · `FEEDBACK_IDENTITY_COOKIES`
6. `pullim-admin` **#60 머지**

### ⚠ `FEEDBACK_IDENTITY_COOKIES` 를 5단계에서 같이 넣어라
값은 pullim-api 의 **`COOKIE_NAME_AT` 과 같은 값**(통합 시크릿, 로컬은 `local-pullim-at`). 도메인 권위는 `COOKIE_DOMAIN=.pullim.ai`.
이걸 빼면 **로그인 사용자의 건의도 `userId: null`** 로 들어오고, **소급으로 채울 수 없다**(수집 시점에만 아는 값).

### ⚠ 버튼은 이미 켜져 있다 — 순서 규칙이 바뀌었다
원래 순서는 "`NEXT_PUBLIC_FEEDBACK_ENABLED` 를 맨 마지막에 켜서 신원 없는 건의가 쌓이는 창을 0 으로" 였다. **그 플래그는 2026-09-14 에 이미 dev 에 켰다**(저장이 없어 쌓일 게 없었으므로 안전했다).
→ **3단계(저장 활성) 시점부터는 그 논리가 되살아난다.** 마이그레이션 직후~5단계 사이에 들어온 건의는 신원이 빈다. 그 구간을 짧게 가져가라.

`NEXT_PUBLIC_*` 는 **빌드 타임 인라인**이다 — env 만 바꾸고 기존 빌드를 재사용하면 반영되지 않는다. **반드시 재배포.**

---

## 4. 확정된 계약 (재논의 금지 — 결론과 근거)

### 데이터
수집 `POST /feedback` (ServiceKeyGuard + `WEB_FEEDBACK`)
```json
{ "service": "admissions", "category": "general|feature|bug|etc",
  "content": "trim 후 1~1000자", "userId": "uuid | null",
  "context": { "pageUrl", "userAgent", "viewport": {"w","h"}, "appVersion" } }
```
응답 `201 { id, seq, createdAt }`. 서버가 `status='received'` 고정.

관리 `GET /admin/feedbacks` · `/meta` · `/:id` · `PATCH /:id`

### 결정과 이유
| 결정 | 이유 |
| --- | --- |
| **`userId` 만 저장.** `displayName`·`email`·`tier`·`isMinor` 컬럼 없음 | 사본을 만들면 파기 정책이 새로 필요해진다(`006 §5.1` 12개월 규칙은 학생 입력 T1/T2 에만 적용, 건의는 분류 밖). 이름은 **읽기 시점 조회**로 붙인다 → 사본 없음·N+1 없음·탈퇴 자연 처리 |
| 이름 해석은 **JOIN 이 아니라 거버넌스 포트**(`UserDirectoryPortInterface`) | `db-structure.md §2` 가 `도메인 모듈 → auth.* 직접 SELECT/JOIN` 을 `[Must]` 로 차단. 결과는 동일(페이지당 배치 1회) |
| **`pageUrl` 은 경로만** 저장(origin 폐기) | ① 서비스마다 보내는 형태가 달라 섞인다 ② `service` 가 이미 앱을 식별 ③ **환경별 호스트가 데이터에 영구히 박힌다** — `service`→호스트 매핑은 콘솔이 들면 나중에 바꿀 수 있지만 데이터는 못 바꾼다. **링크로 만들지 마라**(호스트 없음) |
| **`seq`(bigserial + UNIQUE)** 를 초기 스키마에 | 운영자가 입으로 부르는 접수번호. **소급 불가**. api 는 **문자열**로 응답(안전정수 초과) → 숫자 파싱 금지, `FB-{YYYY}-{seq:0000}` 는 화면이 조립 |
| **상태 이력 테이블**을 v1 에 | `reason` 을 행 컬럼에 두면 `held→reviewing→held` 에서 첫 사유가 덮인다. 사유는 전이에 묶인 값. **이력은 소급 복원 불가** |
| 전이: `received→reviewing\|closed` · `reviewing→adopted\|held\|closed` · `held→reviewing\|closed` · `adopted→closed` · `closed` 종착 | `held→adopted` 는 **금지** — 보류를 채택하려면 실제로 다시 검토한 것이라 `reviewing` 경유가 사실에 맞다(비대칭은 의도). `held→closed` 를 막으면 **안 본 변경이 이력에 '검토'로 남아** 이력이 거짓이 된다 |
| **`resolvedAt` 은 최초 종결 시각, 이후 불변** | `adopted→closed` 에서 덮으면 최초 해결 시점이 사라진다. 언제 닫혔는지는 이력에 있다 |
| **3-상태 직렬화** (`submitter`·`assignee`·`actor` 동일 규칙) | `null` / `{id, name}` / `{id, name: null}`. 비로그인 vs 탈퇴 vs 비활성 담당자를 화면이 구분해야 한다. **기존 배정은 담당자가 비활성이어도 지우지 않는다** — `name: null` 로만 떨어진다 |
| **`WEB_FEEDBACK` 허용 서비스 = `['admissions']`** | 전체로 두면 교차검증이 아무것도 집행하지 못한다. 좁혀야 `service:'planner'` 주장이 실제로 403 이 된다 |
| **답변(`reply`)은 저장만 된다** | 전달 수단 미구현(**폐기가 아니라 보류**). 화면에서 "발송·전송·알림" 어휘 금지, "답변은 저장만 됩니다" 명시. 비로그인·탈퇴 건은 답변 409 |

### admin 콘솔이 의존하는 전제 4건 — **바꾸기 전에 반드시 알려라**
읽음/안읽음을 별도 필드 없이 `status` 로 파생하기로 해서 콘솔이 여기 묶였다. 바뀌면 코드 한 줄이 아니라 **화면 모델이 깨진다.**
1. 수집 시 `status` 는 서버가 `received` 고정(클라이언트 주장 불가)
2. `received → reviewing` 허용
3. `?status=received` 필터
4. `meta.counts` 에 전 상태 키가 항상 존재 + **집계가 `status` 만 제외**(반영하면 상태 칩을 누르는 순간 나머지가 0 이 돼 칩이 죽는다)

---

## 5. 함정 (밟기 쉬운 것들)

- **`pullim-admin` 의 `docs/feature/2026-09-10-건의-관리/plan.md`** 상단 🔴 배너와 `§오너 결정 1`·`§1-1` 이 *"읽음/안읽음으로 축소됐다"* 고 말한다. **그 축소는 2026-09-14 오너가 철회했고 문서는 고치지 않기로 했다.** 구현 기준은 같은 폴더 `artifacts/ui-spec.md`(상태 5종). 그 배너를 보고 범위를 줄이지 마라.
- `NEXT_PUBLIC_*` 빌드 타임 인라인 — env 변경 후 **재배포 필수**.
- `dev-admissions.pullim.ai` 는 Vercel SSO 뒤에 있어 익명 fetch 로 검증할 수 없다(브라우저 쿠키 필요).
- Vercel 재배포 시 **dev 브랜치 배포를 골라야 한다.** feature 브랜치 배포를 재배포하면 `dev-admissions.pullim.ai` alias 가 안 바뀐다.
- `admissions`(입시코치)에는 **DB 가 없다.** `apps/web` 뿐이고 엔티티·마이그레이션이 없다. 마이그레이션은 전부 pullim-api 쪽 일이다.
- `pullim-admin` 은 로그인 벽이 있어 로컬 확인 시 인증이 필요하다. 픽스처는 `NEXT_PUBLIC_FEEDBACKS_FIXTURES=1`(포트 3010).

---

## 6. 후속 항목 (v1 밖, 기록만)

| # | 내용 |
| --- | --- |
| 1 | **접수번호로 검색이 안 된다** — `q` 는 `content` ILIKE 전용. 운영자가 `FB-2026-0913` 을 칠 가능성이 높다. `seq` 완전일치를 `q` 에 얹거나 별도 파라미터. 지금은 화면 안내 문구로만 메웠다 |
| 2 | **작성자명 검색** — 두 갈래가 다르다. (가) 실명 완전일치: 기존 포트 재사용, 단 AES-GCM 이라 부분일치 불가("홍"으로 못 찾음) / (나) **표시명 부분일치**: 평문이라 가능하지만 포트 메서드 신설 필요. **콘솔이 원하는 건 (나)** |
| 3 | **두 번째 서비스 온보딩 선결 조건** — `WEB_FEEDBACK` 배열을 넓히지 말고 **전용 소비자 키를 발급**하라. 그 시점에 `ServiceKeyGuard` 의 "라우트당 소비자 1개" 제약과 `userId` 신뢰 경계를 함께 다룬다 |
| 4 | **답변 전달 경로** — 보류 상태. 사용자 표면에 수신함이 없어 정의 불가. 최후 수단은 회원 이메일 조회 발송 |
| 5 | `meta.assignees[]` 는 공용 staff 표면이 생기면 걷어낼 필드. 더 맞는 자리는 `/admin/members` 에 `globalRole` 필터 추가(이미 `globalRole` 을 응답에 싣고 있어 필터만 없다) |
| 6 | `apps/web` 의 웹훅 관련 코드(`webhook-target.ts`·`webhook-post.ts`, `FEEDBACK_WEBHOOK_*`)는 **현재 미사용**. SSRF 방어가 담겨 있어 남겨 뒀다 — 정리는 별건 |
| 7 | admin 콘솔: 필터 URL 동기화 없음(상세에서 뒤로 가면 필터 초기화) · nav 활성 탭 표시 없음(공유 파일이라 단독 카드) |

---

## 7. 검증 상태

- pullim-admissions-coach: web 667 / shared 139 · 뮤테이션 23종
- pullim-api: test 4,034 · e2e 1,619 · integration 893 · 뮤테이션 27종 · 회귀 0
- pullim-admin: 461 tests · 프로덕션 번들에 픽스처 0건(빌드 산출물 grep 으로 실측)

**⚠ E2E 는 어느 저장소도 실 응답으로 검증하지 못했다.** api 미배포. 배포 후 **필드명·널 형태·에러 메시지**를 실제로 맞춰 봐야 한다 — 그게 3단계 직후 첫 할 일이다.
