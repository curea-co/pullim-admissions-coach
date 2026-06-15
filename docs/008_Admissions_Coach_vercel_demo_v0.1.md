# Vercel Demo 환경 v0.1 — 임시 시연용

확정일: 2026-05-29 (금)
작성자: 최선혜 (Education Product Owner)
성격: **임시 preview**. *production 아님.*
연관 문서: [`002_..._definition_v.3.md`](002_Admissions_Coach_definition_v.3.md) §6.3 / [`006_..._data_security_policy_v0.1.md`](006_Admissions_Coach_data_security_policy_v0.1.md) §4 / [`004_..._coding_plan_v0.1.md`](004_Admissions_Coach_coding_plan_v0.1.md) Phase 0

> **목적:** Gate keeper의 AWS Organizations + 3계정 셋업이 끝나기 전, 검수자·CEO·대표님께 *클릭 가능한 시연 URL* 1건을 제공하기 위함. 실 사용자·실 데이터·실 운영 의도 없음.

---

## 1. 명명·범위

- **호칭:** "Vercel **demo**" 또는 "Vercel **preview**". *prod 아님.*
- prod 아키텍처는 AWS Seoul ECS (코딩 계획 §3 / 아키텍처 v0.1 / 검수자 결정 4.2) 유지.
- 본 환경은 main 브랜치 push 시 자동 배포 → 공개 URL 제공.

## 2. 가드레일 (코드 강제)

| 가드 | 구현 |
|---|---|
| 데모 환경 시각 식별 | [`apps/web/components/demo-banner.tsx`](../apps/web/components/demo-banner.tsx) — `NEXT_PUBLIC_DEMO === 'true'` 일 때 페이지 상단 노란 배너 노출 |
| 검색엔진 인덱싱 차단 | [`apps/web/app/layout.tsx`](../apps/web/app/layout.tsx) — `robots: { index: false, follow: false }` 조건부 |
| 실 데이터 처리 차단 | 백엔드(api·DB) 미연결. 현 단계는 mock·합성 데이터만 (정의 §6.3·정책 §4 정합) |
| Phase E 기능 미가동 | 결제·인증·KMS·알림톡·SES — Vercel demo에서 호출 경로 없음 |

## 3. Vercel 프로젝트 설정 (사용자 1회 수동)

### A. 프로젝트 import

1. https://vercel.com → GitHub 로그인
2. **Add New… → Project** → 리포지토리 선택: `curea-co/pullim-admissions-coach`
3. **Configure Project** 단계에서:
   - **Root Directory:** `apps/web` ← *반드시 이걸로 설정*
   - **Framework Preset:** Next.js (자동 인식)
   - **Build Command:** (비워두면 기본값으로 OK)
   - **Install Command:** (비워두면 OK — pnpm 자동 감지)
   - **Output Directory:** (비워두면 OK)
4. **Environment Variables:**
   - `NEXT_PUBLIC_DEMO` = `true` (필수 — 가드 활성)
5. **Deploy** 클릭

### B. Production Branch 설정

- Vercel 프로젝트 **Settings → Git → Production Branch** = `main`
- main 브랜치 push 시 자동 배포 트리거됨.
- PR 브랜치는 별도 Preview URL이 생성됨 (안전).

### C. 도메인 (선택)

- 기본: `pullim-admissions-coach.vercel.app` (Vercel 자동 할당)
- 권고: 커스텀 도메인 `demo.pullim.curea.co` 또는 `preview.pullim.curea.co`
  - Vercel Settings → Domains 에 추가
  - Route 53에 CNAME → `cname.vercel-dns.com`
- **`staging.pullim.curea.co`·`pullim.curea.co`는 AWS prod용이므로 Vercel에 절대 매핑 금지.**

### D. (선택) Basic Auth — 외부 노출 제한

Vercel은 Pro 플랜 이상에서 [Password Protection](https://vercel.com/docs/security/deployment-protection) 지원.
무료 대안: 미들웨어로 Basic Auth (필요 시 별도 PR로 추가).

## 4. 동작 확인 체크리스트 (배포 직후)

- [ ] 페이지 상단에 노란 "⚠️ 데모 환경" 배너 노출
- [ ] HTML `<head>`에 `<meta name="robots" content="noindex,nofollow">` 포함
- [ ] 5 라우트 200 (`/`, `/submit`, `/consent`, `/processing`, `/result`, `/parent`)
- [ ] 폼 검증·동의 차단·SLA 상태머신 정상 동작
- [ ] 학부 5계열·학교유형 4종 정상 노출

## 5. Retire 조건 (반드시 수행)

**Phase 0 AWS staging이 가동되는 즉시** 본 환경을 폐기한다.

| 트리거 | 작업 |
|---|---|
| `staging.pullim.curea.co` HTTPS 200 + 5 라우트 동작 확인 | Vercel 프로젝트 archive 또는 delete |
| 검수자·CEO 시연 채널을 AWS staging URL로 전환 | 본 문서를 v0.2로 갱신해 "retired" 표시 |
| 커스텀 도메인(`demo.pullim.curea.co`) 사용 시 | Route 53 CNAME 제거 |
| 코드 측 | `NEXT_PUBLIC_DEMO` 환경변수 제거 + DemoBanner 호출 제거 (또는 컴포넌트 자체 보존하되 미호출) |

**Phase E(실 사용자 데이터 수집 시작) 진입 전까지 Vercel demo가 살아 있을 경우:** 즉시 Vercel 배포 중단·삭제. 미성년자 PII가 데모 환경에 흘러갈 위험을 0으로.

## 6. 책임·의사결정 이력

| 일자 | 결정 |
|---|---|
| 2026-05-28 | 기술 스택 4.2: 백엔드 NestJS + DB AWS RDS 서울. Vercel prod 미사용 결정 |
| 2026-05-29 | Vercel **demo** 추가 채택. *prod와 분리 명명* 합의. AWS staging 가동 시 retire |

## 7. 변경 이력

| 버전 | 일자 | 변경 |
|---|---|---|
| v0.1 | 2026-05-29 | 초안. Vercel demo 설정 절차·가드레일·retire 조건 정의 |
