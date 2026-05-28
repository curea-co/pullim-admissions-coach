# Terraform skeleton — staging

본 디렉토리는 **회사 표준 Terraform 모듈에 본 서비스 사양을 끼워넣기 위한 *계약 문서*** 다. 실제 `*_stub` 모듈은 의도적으로 만들지 않았다. DevOps가 본 파일을 회사 표준 모듈로 교체해 적용한다.

## 교체 가이드

| stub 경로 | 회사 표준 모듈 (예) |
|---|---|
| `./modules/network_stub` | `git::ssh://...curea-co/terraform-modules.git//network?ref=v1` |
| `./modules/kms_stub` | 회사 KMS 모듈 |
| `./modules/s3_stub` | 회사 S3 모듈 |
| `./modules/rds_stub` | 회사 RDS 모듈 |
| `./modules/redis_ecs_stub` | 회사 Redis(ECS) 모듈 |
| `./modules/alb_stub` | 회사 ALB 모듈 |
| `./modules/waf_stub` | 회사 WAF 모듈 |
| `./modules/ecs_service_stub` | 회사 ECS 서비스 모듈 |
| `./modules/github_oidc_stub` | 회사 OIDC 모듈 |
| `./modules/ses_stub` | 회사 SES 모듈 |

`main.tf`의 input 변수명·값은 회사 모듈에 맞게 조정. 단 **로컬 `locals.services` 정의(서비스 3개·포트·host_header·health check)는 본 어플리케이션의 사양이므로 보존**해야 함.

## prod

prod 디렉토리는 별도 추가. staging과 거의 동일 구조 + KMS 봉투 암호화·CloudWatch 대시보드·Sentry 통합·WAF rate-limit 룰 본격 가동 (Phase E).

## 적용 순서

`../README.md` §1 "적용 순서" 표 참조.
