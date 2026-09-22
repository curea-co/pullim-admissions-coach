# Admissions CSRF 복구 누락 수정

- 대상: apps/web/lib/api.ts. 최신 dev 6c7d055에서 확인.
- 비교 PR: [Q #314](https://github.com/curea-co/pullim-Q/pull/314), [Q #315](https://github.com/curea-co/pullim-Q/pull/315), [Arcade #74](https://github.com/curea-co/pullim-arcade/pull/74), [Planner #264](https://github.com/curea-co/pullim-planner/pull/264).
- web [#12](https://github.com/curea-co/pullim-web/pull/12)는 응답 필드명 csrfToken 정정이다. web 구현에서도 bootstrap single-flight 및 refresh 뒤 캐시 무효화를 참고했다. web은 일반 403 재시도가 남아 있어 그대로 복사하지 않는다.
- 누락: GET 401 뒤 refresh CSRF 확보, refresh 자체 mismatch 복구, refresh 이후 원요청 mismatch 복구, bootstrap single-flight. 기존 일반 403 일괄 재시도도 오류 코드 기준으로 제한한다.
- 설계: [인증 설계 §4](../specs/2026-06-24-auth-mypage-design.md#4-아키텍처).
- 범위: admissions 클라이언트·회귀 테스트·문서. 비교 저장소 및 API 서버는 수정하지 않는다.
- 검증: API fetch mock 회귀 RED→GREEN, web 전체 테스트·lint·typecheck·build. 실행 결과는 완료 후 기록한다.
- PR·배포: 사용자가 dev PR 생성 및 검증 통과 시 개발 배포를 명시 승인했다.

## 실로그 증거

2026-09-21 13:00:46·13:11:04·13:15:52 KST 개발 API 로그에서 Origin=https://dev-admissions.pullim.ai, POST /auth/refresh 403, cookiePresent=true·csrfTokenPresent=false 확인. 클라이언트 GET 401 이후 refresh 헤더 누락과 일치한다. 민감 헤더 원문은 조회/기록하지 않았다.

## 진행

- 수정 전 회귀: 14 failed / 9 passed. GET 401→refresh CSRF 누락 및 제한 복구 경로 고정.
- 수정 후 API 회귀 27개 통과. 동시 오류 본문 소비·GET 거부·실패 후 재시도 포함.

## 최종 검증

- `pnpm lint`: 경고·오류 없음.
- `pnpm typecheck`: web/shared/engine 통과.
- `pnpm -r test`: shared 156개 + engine 58개 + web 744개 = 958개 통과.
- `pnpm build:web`: 프로덕션 빌드 성공.
- `git diff --check`: 통과.
- 현재 상태: 로컬 수정·검증 완료. 사용자 승인으로 최신 dev를 반영한 뒤 재검증·PR·개발 배포를 진행한다.

## PR·개발 배포

- 사용자 승인으로 최신 dev #103(2d6b268)을 rebase 반영했다. CSRF 파일 충돌 없음.
- 삭제된 mypage의 기존 .next/types 캐시로 타입 검사 1회 실패; 생성 캐시를 분리한 뒤 재검증 통과. 소스 수정 불필요.
- 최신 기준 lint·typecheck·build 통과. 전체 테스트 shared 156 + engine 58 + web 742 = 956개 통과(API 회귀 27개 포함).
- [PR #104](https://github.com/curea-co/pullim-admissions-coach/pull/104), base=dev. Vercel preview 검증 후 dev 머지·기존 dev 도메인 배포 확인을 진행한다.
