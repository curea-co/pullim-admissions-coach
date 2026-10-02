# 확정 만료의 회원 화면 정리

개발 실검증에서 다른 탭 로그아웃 후 results 401 → 실제 refresh 401에도 회원 메뉴가 남았다. 서버 차단은 정상이다.

api client 인스턴스에 만료 구독과 신원 세대를 둔다. 실제 AuthSessionExpiredError만 현재 세대에서 통지한다. Provider는 구독 시 회원·권한 캐시·결과 사용자 스코프를 정리하며 getMe의 늦은 완료/오류를 무시한다. 응답 본문 await 뒤에도 신원 세대를 검사해 옛 DTO의 반환을 차단한다. 로그인·로그아웃 성공 시 세대 변경, 만료 시 추가 서버 logout 없음. 공통 core 사본은 변경하지 않는다.

CSRF bootstrap 401, refresh 403/503, refresh 성공 후 원 요청 401은 만료 통지 대상이 아니다. 결과 데이터 삭제나 새 AI 실행 없이 기존 합성 결과로 배포 후 재검증한다.

회귀 RED→구현→전체 typecheck/lint/shared 및 web test/build, PR base dev. 사용자 개발 실검증 완료 요청의 회귀 수정이며 운영 반영은 하지 않는다.

## 검증 결과

- 최신 origin/dev `100146d`에서 독립 worktree로 시작, 기존 서버와 작업 디렉터리 보존.
- 신규 만료 알림 회귀 3개 RED 확인 후 구현. 대상 API/Provider 2 suites 35 tests PASS.
- 전체 lint 무경고, workspace typecheck PASS, shared 11 suites 156 tests PASS, web 60 suites 778 tests PASS, production build PASS.
- root 자체 production 코드 리뷰 Must Fix 없음. 공통 core/contract 변경 없음, diff check PASS.
- 증거 `/tmp/admissions-expiry-{red,target,lint,types,shared,tests,build}.log`. 개발 실브라우저 수정판 확인은 PR 병합·git 자동 배포 후 별도 수행한다. 기존 합성 AI 결과를 재사용하며 새 분석 비용을 발생시키지 않는다.
