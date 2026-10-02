# 인증 요청 공통 코드 통일

사용자 승인: 10개 프런트에 동일 무의존 코드를 복사하고 앱별 DTO/환경 adapter를 유지한다. WT-4. 신규 registry/dependency/배포 없음.

설계: auth-core.ts VERSION1.0.0 정본 템플릿과 바이트 동일 유지. typed CSRF mismatch만1회 복구, Origin/권한403 재시도0,401 후 refresh와 원요청 각각1회. refresh401만 세션만료,403/5xx/네트워크는 오류 보존. 실패 backoff5~60초+jitter, same-origin WebLocks+성공1초재사용, API origin+member/staff scope. 서버 인스턴스는 요청별 격리. 로그인/로그아웃 확인시 reset. CSRFbootstrap401은 세션만료가 아님.

Classbot401 즉시 OS 이동 정책은 자동refresh 후 실제만료시 이동으로 변경한다. Studio 생성접수/재접수 replay:false 유지. Writing 서버 relay는 request별 생성. UI/응답모델/실제인증서버 보안검증 유지.

검증: 공통 core 동일 시나리오 및 각 앱 adapter 회귀와 필수 게이트. 미실행 검증은 미완료로 기록한다. 2026-10-02 사용자 승인으로 feature 커밋·push·dev 대상 PR 생성을 진행한다. 머지·배포는 별도 판정 전까지 보류한다.

## 복사본 관리

정본 저장소/registry를 새로 만들지 않는다. 공통 파일 수정은10개 저장소에 같은 VERSION과 같은 파일을 일괄 복사하고, core와 contract 각각 SHA256을 대조한다. 앱별 설정·DTO·UI는 adapter만 수정한다. 모든 저장소의 공통계약시험과 필수게이트 완료 후 버전별PR/개발검증을 진행한다. 일부만 바뀌면 전체통일완료로 선언하지 않는다.

VERSION1.0.0: core `a3b58e771922437d9deffb7af50345b09dab01e25bd119ddc7655686054558b8`, contract `64bb2abce16c7d6450f3b1f904ffb5d77c238082b53e2ce3bf7823f3eb7bdb75`. 공통13개회귀. bootstrap401만 AuthBootstrapError(status0), 나머지bootstrap오류원형보존. 세션조회는 실제refresh401마커만 미인증으로처리; 갱신성공뒤/me401은오류다.

## 검증 결과

typecheck, lint(0warning), build, 전체 Vitest58suites768tests 모두PASS. 로그 /tmp/admissions-auth-{type,lint,build,all-final}.log. 새backoff회귀 RED1/27PASS → 통합후공통13포함768PASS.

코드/실제adapter공통연결완료. 당시 실브라우저E2E/SSO는 NOT_RUN; 후속 로컬 결과는 아래 참조. 배포검증은 NOT_RUN. 로컬 검증 시점에는 커밋·PR·push·배포하지 않았고, 이후 사용자 승인으로 dev 대상 PR을 준비한다. 기존dirty없음,manifest/lock변경없음.

## 로컬 실제 API 검증 보완

기존 origin/dev 로그인 기본복귀 `/mypage`는 삭제된 페이지여서 실제 로그인 성공 후404가 발생했다. 계정 설정은OS에 위임한 현재 UX에 맞춰 기본복귀를 앱 홈 `/`로 바꾸고 명시적 내부 next는 유지한다. 실제 로컬 API production build+브라우저로 로그인·보호result·access갱신·로그아웃을 검증한다.

### 로컬 production + 실제 API 결과 (2026-10-02)

실제 로컬 DB의 전용 synthetic 계정, 로컬 API/쿠키/CSRF를 사용했다. 외부 API 요청은 브라우저에서 차단했고 탐지 0건이다. 운영 계정/외부 KCB·메일·LLM은 사용하지 않았다.

| 시나리오 | 결과 |
| --- | --- |
| 미인증 `/result` | `/me401`→refresh401→중앙 로그인 이동 |
| 실제 로그인 폼 | login200→me200→수정된 기본 홈 `/` 도착 |
| 보호 `/result` | me200·entitlements200·admissions/results200 |
| access 쿠키만 삭제 | me401→csrf200→refresh200→me200 |
| 준비된 동일 origin 두 탭 동시 reload | refresh 1회200, 두 탭 동일 성공 stamp |
| UI 로그아웃 | logout204, 다시 보호 경로 진입 시 중앙 로그인 |

HTTP `*.pullim.local`은 기본적으로 WebLocks가 없어 초기 두 탭에서 각 1회 갱신했다. 별도 Chrome 테스트 세션에 정확한 로컬 origin만 `--unsafely-treat-insecure-origin-as-secure`로 지정한 후 locks=true와 1회 갱신을 확인했다. 이 옵션은 제품 설정에 반영하지 않았으며 실제 TLS 배포 검증이 아니다. 처음 cold-page 로딩은 1초 성공재사용 구간 밖일 수 있어 2회 관측을 결함으로 단정하지 않는다.

기존 기본복귀 결함은 origin/dev에도 존재했다. 새 로그인 회귀 RED 2실패/1통과→GREEN3통과, 수정 후 lint(0경고)/typecheck/local API production build PASS. 로그 `/tmp/admissions-login-{red,green}.log`, `/tmp/admissions-local-{lint,typecheck}.log`, `/tmp/admissions-local-api-build.log`.

실행: 저장소 루트에서 다음 환경으로 `pnpm --filter @pullim/web build`, 이어 apps/web에서 동일 환경 `pnpm exec next start -p 3107 -H 0.0.0.0`.
`NEXT_PUBLIC_AUTH_BACKEND=pullim NEXT_PUBLIC_PULLIM_API=http://api.pullim.local:3000 NEXT_PUBLIC_OS_URL=http://os.pullim.local:3101 NEXT_PUBLIC_DEV_ENTITLEMENT_BYPASS=false NEXT_PUBLIC_DEV_GATE_BYPASS=false`

URL `http://admissions.pullim.local:3107`, 서버 로그 `/tmp/admissions-local-api-server.log`. 시스템 hosts에 admissions가 없어 일반 브라우저에는 DNS 등록이 필요하다. 검증 Chrome만 `--host-resolver-rules=MAP *.pullim.local 127.0.0.1` 사용했다. 서버는 사용자 확인을 위해 유지한다. 비밀번호/쿠키/응답PII는 증적에 기록하지 않는다.

최종 추가 회귀 포함 전체 Vitest **59 suites / 771 tests PASS** (`/tmp/admissions-local-final-tests.log`). 비민감 실검증 집계 `/tmp/auth-group1-local-verification.json` (0600).

## PR 진행 승인

2026-10-02 사용자 요청으로 검증된 feature 변경의 커밋·push·`dev` 대상 PR 생성을 승인받았다. 원격 dev와 시작 HEAD가 동일함을 확인했다. 보호 브랜치 직접 push·머지·배포는 하지 않는다. 임시 fixture/비밀/브라우저 산출물은 커밋에서 제외한다.
