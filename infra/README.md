# Phase 0 Infra Runbook — DevOps 핸드오프

작성: 2026-05-28 · `pullim-infra` 트랙 (PM 대리 작성)
연관: `docs/004_..._coding_plan_v0.1.md` · `docs/005_..._architecture_v0.1.md` · `docs/006_..._data_security_policy_v0.1.md`

> **목적:** 회사 표준 AWS Terraform 모듈을 본 서비스에 적용해 **staging ECS에 띄우기** 위해 DevOps가 필요한 *어플리케이션 측 사양*을 한 곳에 모은 문서. 이 문서가 닫히면 staging URL이 살아나야 한다.

---

## 1. 적용 순서 (DevOps 작업)

| # | 작업 | 의존 | 비고 |
|---:|---|---|---|
| 1 | **AWS Organizations 생성 + 3 계정** (`pullim-dev` / `pullim-staging` / `pullim-prod`) | — | 검수자 결정 4.4. 모든 후속 작업은 계정 격리 |
| 2 | Route 53: `staging.pullim.curea.co` Hosted Zone (혹은 부모 zone의 NS 위임) | 1 | ACM(SSL) 인증서 발급(DNS 검증) |
| 3 | VPC + 서브넷(퍼블릭/프라이빗) + NAT + Bastion (회사 표준 모듈) | 1 | ap-northeast-2 (서울) |
| 4 | ECR 리포 3개: `pullim-admissions-coach-web/api/admin` | 1 | 이미지 retention 정책: 10개 유지 |
| 5 | KMS 키 (CMK) 4개: `rds`, `s3`, `secrets`, `logs` | 1 | Phase E에서 봉투 암호화 본격 사용. 지금은 RDS·S3 SSE-default와 함께 ON만 |
| 6 | RDS PostgreSQL 16 Multi-AZ in 프라이빗 서브넷 | 3, 5 | 마스터 자격은 Secrets Manager. Phase 0 staging은 db.t4g.small로 시작 |
| 7 | Redis (ECS Service Connect로) in 프라이빗 서브넷 | 3 | BullMQ·세션·rate-limit. 회사 표준대로 ECS Service |
| 8 | S3 버킷 2개: `pullim-uploads-staging`(생기부 PDF), `pullim-results-staging`(AI 결과물). **모두 퍼블릭 차단** | 5 | 버전 관리 ON. Presigned URL만 사용 |
| 9 | SES: `curea.co` 도메인 인증 (DKIM·SPF·DMARC) | 1 | Phase E 사용. Phase 0에서는 도메인 인증만 |
| 10 | ALB(퍼블릭) + WAF(Managed Rules + rate-limit) + Route 53 레코드 | 3 | Host 헤더 분기: `staging.pullim.curea.co` |
| 11 | ECS 클러스터(Fargate) + 3 서비스 셸 (`web`, `api`, `admin`) — Phase 0은 web만 실제 트래픽 받음 | 3, 4, 10 | 헬스체크: web=GET `/` 200 (Phase D에서 `/api/health`로 교체) |
| 12 | IAM: GitHub OIDC 페더레이션 + 배포용 IAM Role (계정별) | 1 | 본 리포지토리(curea-co/pullim-admissions-coach) → AssumeRoleWithWebIdentity 신뢰 |
| 13 | Secrets Manager: 초기 시크릿 자리만 (값 없이 슬롯) — §4 참조 | 12 | 값 입력은 Phase B/C에서 |
| 14 | CloudWatch 로그 그룹 + 기본 메트릭 — 알림·대시보드는 Phase E | 11 | 본 단계는 로그 *수집*까지만 |

---

## 2. GitHub Actions 측 요구사항

워크플로: `.github/workflows/deploy-staging-web.yml` 이미 추가됨.

### GitHub 리포지토리 설정 (DevOps가 채워야 할 값)

**Repository Variables** (Settings → Secrets and variables → Actions → Variables):

| 키 | 예시값 | 비고 |
|---|---|---|
| `AWS_REGION` | `ap-northeast-2` | 전 환경 공통 |

**Environment "staging" Variables/Secrets**:

| 키 | 형태 | 예시값 |
|---|---|---|
| `AWS_OIDC_ROLE_ARN_STAGING` (Secret) | ARN | `arn:aws:iam::<staging-acct>:role/github-actions-deploy` |
| `ECR_REPOSITORY_WEB` (Variable) | string | `pullim-admissions-coach-web` |
| `ECS_CLUSTER_STAGING` (Variable) | string | `pullim-staging` |
| `ECS_SERVICE_WEB_STAGING` (Variable) | string | `pullim-web` |
| `ECS_TASK_DEFINITION_WEB` (Variable) | string | `pullim-web` (family name) |
| `ECS_CONTAINER_NAME_WEB` (Variable) | string | `web` |

### OIDC IAM Role 신뢰 정책 핵심

```json
{
  "Effect": "Allow",
  "Principal": { "Federated": "arn:aws:iam::<acct>:oidc-provider/token.actions.githubusercontent.com" },
  "Action": "sts:AssumeRoleWithWebIdentity",
  "Condition": {
    "StringEquals": {
      "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
    },
    "StringLike": {
      "token.actions.githubusercontent.com:sub": "repo:curea-co/pullim-admissions-coach:*"
    }
  }
}
```

IAM Role 최소 권한: `ecr:GetAuthorizationToken`, `ecr:BatchCheckLayerAvailability`, `ecr:InitiateLayerUpload`, `ecr:UploadLayerPart`, `ecr:CompleteLayerUpload`, `ecr:PutImage`, `ecs:DescribeTaskDefinition`, `ecs:RegisterTaskDefinition`, `ecs:UpdateService`, `ecs:DescribeServices`, `iam:PassRole`(task execution/task role).

---

## 3. ECS Task Definition 사양

### apps/web (Phase 0 핵심 — 실제 배포)

```
Family:          pullim-web
Launch type:     FARGATE
Network mode:    awsvpc
CPU:             512 (0.5 vCPU)
Memory:          1024 MB
OS/Arch:         Linux / X86_64
Task Role:       arn:aws:iam::<acct>:role/pullim-web-task
Execution Role:  arn:aws:iam::<acct>:role/pullim-ecs-execution

Containers:
  - name: web
    image: <ECR>/pullim-admissions-coach-web:<tag>
    portMappings:
      - containerPort: 3030
        protocol: tcp
    essential: true
    healthCheck:
      command: ["CMD", "wget", "-q", "--spider", "http://127.0.0.1:3030/"]
      interval: 30
      timeout: 5
      retries: 3
      startPeriod: 15
    logConfiguration:
      logDriver: awslogs
      options:
        awslogs-group: /pullim/staging/web
        awslogs-region: ap-northeast-2
        awslogs-stream-prefix: web
    environment:
      - { name: NODE_ENV,                value: production }
      - { name: PORT,                    value: "3030" }
      - { name: NEXT_TELEMETRY_DISABLED, value: "1" }
    # secrets는 §4 참조 (Phase 0 web은 아직 시크릿 의존 없음)
```

**ALB Target Group:**
- Protocol: HTTP, Port: 3030
- Health check path: `/`
- Healthy threshold: 2, Interval: 30s, Timeout: 5s
- Deregistration delay: 30s
- Stickiness: OFF

**ALB Listener Rule (Host 헤더 분기):**

| Host 헤더 | Target |
|---|---|
| `staging.pullim.curea.co` | `pullim-web` TG |
| `api.staging.pullim.curea.co` | `pullim-api` TG (Phase C 활성) |
| `admin.staging.pullim.curea.co` | `pullim-admin` TG (Phase C 활성) |

### apps/api / apps/admin

Phase 0는 빈 셸 서비스만. Phase C에서 NestJS·Next.js admin 컨테이너 이미지 추가하며 task definition 채움. 리소스(클러스터·target group·DNS)는 미리 만들어 두면 Phase C 시 코드만 푸시.

---

## 4. 시크릿·환경변수 명세 (Secrets Manager 키 자리)

Phase 0 web은 시크릿 없이 부트 가능. 아래는 Phase B 이후 추가될 슬롯 (DevOps가 자리만 만들어 두면 BE가 값을 채움).

| 슬롯 | 사용처 (Phase) | 비고 |
|---|---|---|
| `pullim/staging/rds/master` | C | RDS 자동 생성 후 ARN을 BE 트랙에 공유 |
| `pullim/staging/redis/url` | C | Service Connect endpoint |
| `pullim/staging/jwt/secret` | E | Passport JWT 서명용 |
| `pullim/staging/anthropic/api-key` | D | Claude API 호출. 학습 불사용 옵션 검증 후 키 발급 |
| `pullim/staging/toss/secret-key` | E | Toss Payments |
| `pullim/staging/kakao/biz-token` | E | 알림톡 발신 토큰 |
| `pullim/staging/ses/smtp` | E | (SES SDK 사용 시 IAM이라 불필요할 수 있음) |

---

## 5. 도메인·SSL

- **루트 도메인 소유**: `curea.co` (현재 GitHub Org와 동일 회사)
- **staging 서브도메인**: `staging.pullim.curea.co` (메인 web) / `api.staging.pullim.curea.co` / `admin.staging.pullim.curea.co`
- **prod 서브도메인 (Phase E)**: `pullim.curea.co` / `api.pullim.curea.co` / `admin.pullim.curea.co`
- ACM 인증서: 단일 ALB이므로 와일드카드 1장 권고 — `*.staging.pullim.curea.co` 및 `*.pullim.curea.co`

> 향후 도메인 통합 결정 시 (대표님 제안 `*.pullim.ai` 등) 본 매핑은 cascade 영향 — 메모리 [[ceo-domain-unification-pending]] 참조. **현 시점은 `pullim.curea.co` 단일 가정**.

---

## 6. WAF 룰 (정책 §6.3 정합)

| 규칙 | 동작 |
|---|---|
| AWS Managed: Core rule set | Count → 검증 후 Block |
| AWS Managed: Known bad inputs | Block |
| AWS Managed: SQL injection / XSS | Block |
| Rate-limit: `/api/auth/*` | 분당 5회 실패 시 IP 차단 (Phase E 가동, Phase 0은 룰 자리만) |
| Rate-limit: `/api/submit` | 사용자당 분당 3회 (Phase C 가동) |
| Rate-limit: `/api/consent` | 사용자당 분당 5회 (Phase E 가동) |
| Geo: 한국 외 차단 | OPTIONAL — 마케팅 정책에 따라 Phase E 결정 |

---

## 7. 데이터·보안 정합 (필수 게이트)

본 인프라는 `docs/006_..._data_security_policy_v0.1.md`의 단계적 시행 §4를 어겨서는 안 된다.

- **Phase 0 staging은 실 미성년자 데이터 수집 금지.** UI에 "Phase A 시각 셸 — 실 데이터 수집 안 함" 라벨이 노출되어 있고, /submit 폼은 Phase B까지 mock 데이터만.
- S3 버킷 퍼블릭 차단 ON, ACL 비활성, BlockPublicAccess 4 옵션 모두 ON.
- RDS 퍼블릭 액세스 OFF. Bastion 또는 SSM Session Manager만.
- 모든 환경별 KMS 키 분리 (dev/staging/prod 교차 사용 금지).

---

## 8. 검증 체크리스트 (DevOps가 닫아야 종료)

- [ ] 3개 AWS 계정 생성 (Organizations) + 빌링 콘솔리데이션
- [ ] staging VPC + 서브넷 + NAT + Bastion 적용
- [ ] ECR 리포 3개 생성, 이미지 retention 정책 적용
- [ ] KMS CMK 4개 생성 (rds/s3/secrets/logs)
- [ ] RDS Postgres Multi-AZ 부팅 (db.t4g.small), 마스터 시크릿 → Secrets Manager
- [ ] Redis ECS 서비스 (BullMQ·세션) 부팅
- [ ] S3 2 버킷 (uploads/results) — 퍼블릭 차단 4 옵션 모두 ON
- [ ] SES 도메인 인증 완료 (DKIM·SPF·DMARC)
- [ ] ALB + WAF + Route 53 + ACM 인증서, Host 헤더 분기 룰 적용
- [ ] ECS 클러스터 + web 서비스 부팅, ALB target group 등록
- [ ] GitHub OIDC IAM Role 생성, 신뢰정책 본 리포로 제한
- [ ] GitHub Actions Repo/Env Variables·Secrets 입력
- [ ] CloudWatch 로그 그룹 3개 생성
- [ ] 첫 배포 트리거: GitHub Actions `deploy-staging-web` workflow 실행
- [ ] **수동 확인**: `https://staging.pullim.curea.co` HTTPS 200, 5 라우트 클릭 시연 가능

본 14개 모두 닫히면 Phase 0 종료. EPO·CEO 시연 URL 공유.

---

## 9. Terraform 스켈레톤

`infra/terraform/staging/` 디렉토리에 *예시 모듈 호출*을 두었다 (`./terraform/staging/main.tf` 참조). 회사 표준 모듈 ARN으로 source를 교체해 적용. 본 스켈레톤은 *계약 문서* 수준이며 실제 회사 모듈을 대체하지 않는다.

---

## 10. 책임 분리

| 항목 | 누가 |
|---|---|
| 본 런북 작성·유지 | PM 대리 (`pullim-infra`) |
| AWS 자원 프로비저닝·Terraform 적용 | 회사 DevOps팀 |
| GitHub Repo Secrets/Variables 입력 | 회사 DevOps팀 |
| 도메인 등록·ACM 인증서 발급 | 회사 DevOps팀 |
| 첫 배포 트리거·결과 검증 | DevOps + PM 합동 |
| 시연 URL 공유 | PM |
