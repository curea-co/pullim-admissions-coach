# 010 입시코치 핸드오프 점검 리포트 — 로그인 연동 마무리 인계용

> 2026-07-02 · 전수 실측(29항목) 기준 · 대상: 로그인 연동 마무리 담당자(최선혜)
> 스택 상태: FE `main@67c32ec`(#55 머지) · pullim-api `dev`(#256 admissions 머지, ADR-058 채택)

## 0. 한 줄 결론

**기능 코어는 완성 상태** — 인가·동의 게이트·서버 마스킹·즉시삭제(CASCADE)·실 Claude 진단(E2E 40~90초 done)까지
29항목 전수 통과. **단 §3 미검증 1건(브라우저 로그인 후 UI 수동 패스)과 §4 OAuth 미검증을 완료해야 릴리스 게이트 통과**
— API 레벨 완성 기준의 핸드오프이며, 그 2건은 인계 후 첫 작업으로 남긴다.

## 1. 아키텍처 요약 (무엇이 어디에 있나)

```
입시코치 FE (이 레포, os.pullim.local:3007)
  ├─ 인증: pullim-api 실 멤버 인증 소비 — 로그인/가입 버튼은 OS(pullim.local:3001)로 SSO redirect
  │        어댑터 = apps/web/lib/auth/pullim-api-adapter.ts (/me 계약 정합·isMinor 만19 포함)
  └─ 진단: apps/web/lib/admissions-api.ts — 제출→동의→진단 enqueue→done 폴링→결과 서버 재조회
           (세션엔 비민감 진단 id 포인터만. FE /api/analyze 는 물리 제거됨 — 이 PR)

pullim-api admissions 서비스 (10번째 경계, ADR-058 · 설계 4뷰 = docs/design/services/admissions/)
  ├─ POST/GET/DELETE /admissions/submissions[/:id]      (uuid ID·저장 전 서버 마스킹·보존 30일 파기 cron)
  ├─ POST/GET       /admissions/submissions/:id/consents (append-only·미성년=서버 권위 isMinor)
  ├─ POST           /admissions/submissions/:id/diagnose (동의 게이트 → BullMQ enqueue)
  ├─ GET            /admissions/results[/:id]            (본인 결과)
  └─ GET            /admissions/parent/summary/:uid      (학부모 요약 — 본문 비노출)
  워커: claim→engine/analyze(Claude opus·haiku)→§6 lintGuardrails→done · recovery cron(5분)
```

## 2. 로컬 기동 절차 (전부 필요)

1. **Docker**: `cd pullim-api && pnpm db:up` (Postgres 5432 + Redis — 통합 시크릿에서 자격 수령)
2. **api**: `cd pullim-api && pnpm build && APP_ENV=local node --env-file-if-exists=.env dist/main.js` (3000)
   - `.env` 에 `APP_ENV`·AWS 자격(시크릿 `pullim/local/backend` 읽기용)만. DB·Redis·`ANTHROPIC_API_KEY` 는 AWS 통합 시크릿.
3. **OS(pullim-web)**: ⚠️ `pnpm dev` 가 워크스페이스 오설정으로 깨짐 → **`./node_modules/.bin/next dev -p 3001`** 로 우회
   (pullim-web 레포 `pnpm-workspace.yaml` packages 누락 — 수정 권장)
4. **FE**: `cd apps/web && pnpm dev` (3007). `apps/web/.env.local` 에 `NEXT_PUBLIC_OS_URL`·`NEXT_PUBLIC_AUTH_BACKEND=pullim`·`NEXT_PUBLIC_PULLIM_API` 필요.
5. **hosts**: `pullim.local`·`os.pullim.local`·`api.pullim.local` → 127.0.0.1 (쿠키 Domain=.pullim.local 공유)
6. **테스트 계정**: 자격은 커밋하지 않는다 — local 전용 dev seed 엔드포인트로 본인 계정을 직접 생성해 사용
   (`POST /auth/dev/seed-member` — email·password 본인 임의값. 기존 공용 테스트 자격이 필요하면 별도 채널로 전달)

## 3. 점검 결과 (2026-07-02 라이브 전수)

### 통과 — 29/29

| 영역 | 검증 항목 |
|---|---|
| 인프라 | FE·api·OS·Postgres·Redis 기동 (5) |
| 인증 | 로그인 200 · `/me` isMinor(만19·KST) 포함 (2) |
| 인가 | 비로그인 401(2표면) · **타인 소유 403 — 제출 조회·결과 조회·삭제·학부모요약 전부** (6) |
| 제출 | uuid 생성·목록·응답 본문 비노출 · **DB 저장분 서버 마스킹**(`[전화번호]` 치환 DB 직접 확인) (4) |
| 동의 | **무동의 진단 403**(게이트) · 적재(terms·privacy) · isMinor=서버 권위값(body 필드 없음) (3) |
| 진단 | enqueue(pending)→워커 **40초 done**(실 Claude) · 본문 완결(진단 3역량·rubric 6·면접 4) (3) |
| 학부모 | 요약 hasResult/status/시각만 · **본문 비노출** (2) |
| 삭제 | 본인 204 · **FK CASCADE 완전 파기**(제출·동의·진단 0행 DB 확인) · 삭제 후 404 (3) |
| FE | 비로그인 /submit→OS 로그인 redirect(next 복귀) · parent 예시 배너·프라이버시 노트 · **프로덕션 빌드 14/14** · vitest 154/154 (4) |

### 미검증 1건 (형식적 확인 권장)

- **브라우저 로그인 후 화면 흐름**(제출→동의→processing→결과 UI) — API 레벨은 전부 검증됐고,
  자동화 도구로 비밀번호 입력을 하지 않아 브라우저 1회 수동 패스만 남음(§2-6 시드 계정 사용).

## 4. 로그인 연동 관련 인계 사항

- FE 어댑터는 실 `/me` 계약과 정합 완료. **email/password 경로만 검증됨** — OAuth(카카오·네이버) 브라우저
  플로우는 미검증(OS 쪽 소관 포함).
- 가입도 OS `/signup` SSO redirect(로그인과 대칭 — `osSignupHref`, 단위테스트 8케이스).
- `guardianConsent: 'unknown'` — 마이페이지 "보호자 동의 상태 확인 필요" 중립 표시.
  실값 연결은 admissions consents 조회(권위 소스) 후속.
- prod 배포 시: 호스트 = `exam.pullim.ai`(SoT: pullim-api 레포 `docs/design/_platform/plan.md` 표면 표 — 이 레포엔 없음), 시크릿 `pullim/dev|prod/backend` 에
  `ANTHROPIC_API_KEY` 등재 필요(현재 local 만).

## 5. 잔여 목록 (기능 아님 — 정리·후속 카드)

| 항목 | 상태 | 근거/추적 |
|---|---|---|
| FE analyze 실패경로 테스트(레이트리밋·413·fail-loud) | 라우트 삭제로 함께 은퇴 — 해당 책임은 백엔드로 이전(입력 상한=DTO MaxLength·인가=Guard·부하=BullMQ) | pullim-api #256 |
| 종단 트윈(priorSaengbu 2학기 비교) | 백엔드 미지원(단일 학기만) | 후속 카드 |
| 보호자↔자녀 연결(진짜 학부모 계정 열람) | 미구현 — 현재 본인 요약만 | ADR-058 ⑤ |
| NER 비식별화·record_text 저장 암호화 | 잠정 통제 집합으로 운영(법무 게이트) | ADR-058 ② |
| diagnose 요청 멱등키 | 클라 보수 처리만(재시도 시 기존 진단 재사용) — 백엔드 후속 | #55 코멘트 |
| pullim-web `pnpm dev` 오설정 | 우회 중 — pullim-web 레포 수정 | §2-3 |
| PR #53(구 백엔드 설계 문서) | pullim-api ADR-058+4뷰로 대체됨 — 닫기 권장 | superseded |
| `lib/mock/park-junho.ts` | **의도적 유지**(parent 예시 사례·데모 고지) | — |

## 6. 참고 링크

- pullim-api admissions 설계 4뷰: `pullim-api/docs/design/services/admissions/{README,api,data-model,authz}.md`
- 결정 기록: `pullim-api/docs/design/_platform/adr/ADR-058-admissions-서비스-신설.yaml`
- 주요 PR: FE #54(실 인증)·#55(admissions 연동) · pullim-api #250(/me isMinor)·#256(admissions 서비스)
