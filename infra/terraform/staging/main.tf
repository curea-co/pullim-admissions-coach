###############################################################################
# Pullim Admissions Coach — staging environment (illustrative skeleton)
#
# 본 파일은 *계약 문서* 수준이다. 회사 표준 Terraform 모듈을 가진 DevOps팀이
# 본 사양을 회사 모듈로 교체해 실제 적용한다. `source = "../../../modules/..."`
# 부분은 회사 모듈 경로(또는 Terraform Registry / S3 모듈)로 바꿀 것.
#
# 적용 대상 계정: pullim-staging (AWS Organizations)
# 리전: ap-northeast-2 (서울)
###############################################################################

terraform {
  required_version = ">= 1.7"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }

  # 백엔드 S3 + DynamoDB 잠금 — 계정·키 이름은 회사 표준에 맞춰 교체
  backend "s3" {
    bucket         = "curea-terraform-state-staging"
    key            = "pullim-admissions-coach/staging/terraform.tfstate"
    region         = "ap-northeast-2"
    encrypt        = true
    dynamodb_table = "curea-terraform-locks"
  }
}

provider "aws" {
  region = "ap-northeast-2"
  default_tags {
    tags = {
      Project     = "pullim-admissions-coach"
      Environment = "staging"
      ManagedBy   = "terraform"
      Owner       = "pullim-team"
    }
  }
}

locals {
  name_prefix = "pullim-staging"

  # Phase 0는 web만 실제 트래픽. api/admin은 셸만.
  services = {
    web = {
      cpu             = 512
      memory          = 1024
      desired_count   = 1
      container_port  = 3030
      host_header     = "staging.pullim.curea.co"
      health_check    = "/"
      enabled_in_alb  = true
    }
    api = {
      cpu             = 512
      memory          = 1024
      desired_count   = 0  # Phase C에서 1로
      container_port  = 3000
      host_header     = "api.staging.pullim.curea.co"
      health_check    = "/health"
      enabled_in_alb  = false
    }
    admin = {
      cpu             = 512
      memory          = 1024
      desired_count   = 0  # Phase C에서 1로
      container_port  = 3030
      host_header     = "admin.staging.pullim.curea.co"
      health_check    = "/"
      enabled_in_alb  = false
    }
  }
}

###############################################################################
# Networking — VPC, 서브넷, NAT, Bastion (회사 표준 모듈)
###############################################################################
module "network" {
  # source = "../../modules/network"  ← 회사 표준 모듈로 교체
  source = "./modules/network_stub"

  name_prefix       = local.name_prefix
  vpc_cidr          = "10.20.0.0/16"
  public_subnet_az  = ["ap-northeast-2a", "ap-northeast-2c"]
  private_subnet_az = ["ap-northeast-2a", "ap-northeast-2c"]
  bastion_enabled   = true
}

###############################################################################
# KMS — Phase E 봉투 암호화 본격 사용. Phase 0는 키 생성·SSE-default와 연결.
###############################################################################
module "kms" {
  source = "./modules/kms_stub"

  name_prefix = local.name_prefix
  keys        = ["rds", "s3", "secrets", "logs"]
}

###############################################################################
# S3 — uploads(생기부 PDF), results(AI 산출물). 퍼블릭 차단 4 옵션 모두 ON.
###############################################################################
module "s3_uploads" {
  source = "./modules/s3_stub"

  bucket_name        = "${local.name_prefix}-uploads"
  kms_key_id         = module.kms.key_ids["s3"]
  block_public       = true
  versioning_enabled = true
  lifecycle_rules = [
    {
      id     = "expire-after-12-months"
      prefix = ""
      enabled = true
      expiration_days = 395 # 12개월 + 30일 grace (정책 §5)
    }
  ]
}

module "s3_results" {
  source = "./modules/s3_stub"

  bucket_name        = "${local.name_prefix}-results"
  kms_key_id         = module.kms.key_ids["s3"]
  block_public       = true
  versioning_enabled = true
}

###############################################################################
# RDS PostgreSQL Multi-AZ in private subnets
###############################################################################
module "rds" {
  source = "./modules/rds_stub"

  identifier            = "${local.name_prefix}-pg"
  engine_version        = "16.4"
  instance_class        = "db.t4g.small"
  allocated_storage     = 50
  multi_az              = true
  storage_encrypted     = true
  kms_key_id            = module.kms.key_ids["rds"]
  vpc_id                = module.network.vpc_id
  private_subnet_ids    = module.network.private_subnet_ids
  master_username       = "pullim"
  master_password_arn   = "auto-create" # Secrets Manager 슬롯 자동 생성
  deletion_protection   = true
  performance_insights  = true
  publicly_accessible   = false
}

###############################################################################
# Redis (ECS Service Connect) — BullMQ·세션·rate-limit
# 회사 표준대로 ECS Service. 별도 ElastiCache 미사용.
###############################################################################
module "redis_ecs" {
  source = "./modules/redis_ecs_stub"

  name_prefix         = local.name_prefix
  vpc_id              = module.network.vpc_id
  private_subnet_ids  = module.network.private_subnet_ids
  service_connect_ns  = aws_service_discovery_http_namespace.pullim.arn
}

resource "aws_service_discovery_http_namespace" "pullim" {
  name        = local.name_prefix
  description = "ECS Service Connect namespace for ${local.name_prefix}"
}

###############################################################################
# ALB + WAF + Route 53 + ACM — 단일 ALB, Host 헤더 분기
###############################################################################
module "alb" {
  source = "./modules/alb_stub"

  name_prefix       = local.name_prefix
  vpc_id            = module.network.vpc_id
  public_subnet_ids = module.network.public_subnet_ids
  acm_certificate_arn = data.aws_acm_certificate.staging_wildcard.arn

  listeners = {
    https = {
      port     = 443
      protocol = "HTTPS"
    }
  }
}

module "waf" {
  source = "./modules/waf_stub"

  name_prefix = local.name_prefix
  alb_arn     = module.alb.arn

  managed_rule_sets = [
    "AWSManagedRulesCommonRuleSet",
    "AWSManagedRulesKnownBadInputsRuleSet",
    "AWSManagedRulesSQLiRuleSet",
  ]

  # Rate-limit 룰은 Phase C/E에서 본격 가동 (런북 §6)
  rate_limit_rules = []
}

data "aws_acm_certificate" "staging_wildcard" {
  domain   = "*.staging.pullim.curea.co"
  statuses = ["ISSUED"]
}

###############################################################################
# ECS 클러스터 + 3 서비스
###############################################################################
resource "aws_ecs_cluster" "this" {
  name = local.name_prefix
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

module "ecs_services" {
  for_each = local.services

  source = "./modules/ecs_service_stub"

  name              = "${local.name_prefix}-${each.key}"
  cluster_arn       = aws_ecs_cluster.this.arn
  desired_count     = each.value.desired_count
  cpu               = each.value.cpu
  memory            = each.value.memory
  container_port    = each.value.container_port
  container_name    = each.key
  image             = "${aws_ecr_repository.this[each.key].repository_url}:staging-latest"
  private_subnet_ids = module.network.private_subnet_ids
  vpc_id            = module.network.vpc_id
  alb_listener_arn  = module.alb.listener_arns["https"]
  host_header       = each.value.host_header
  health_check_path = each.value.health_check
  enabled_in_alb    = each.value.enabled_in_alb

  log_group_name = "/pullim/staging/${each.key}"
  log_kms_key_id = module.kms.key_ids["logs"]
}

###############################################################################
# ECR — 3 리포지토리
###############################################################################
resource "aws_ecr_repository" "this" {
  for_each             = local.services
  name                 = "pullim-admissions-coach-${each.key}"
  image_tag_mutability = "MUTABLE"

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = module.kms.key_ids["s3"] # ECR이 KMS 키 공유 가능; 별도 키 분리 시 교체
  }

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "keep_last_10" {
  for_each   = aws_ecr_repository.this
  repository = each.value.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}

###############################################################################
# GitHub Actions OIDC + 배포 Role
###############################################################################
module "github_oidc" {
  source = "./modules/github_oidc_stub"

  github_repository = "curea-co/pullim-admissions-coach"
  role_name         = "${local.name_prefix}-github-actions-deploy"
  ecr_arns          = [for r in aws_ecr_repository.this : r.arn]
  ecs_cluster_arn   = aws_ecs_cluster.this.arn
}

###############################################################################
# SES 도메인 인증 — Phase E 사용 위한 사전 준비
###############################################################################
module "ses_domain" {
  source = "./modules/ses_stub"

  domain          = "curea.co"
  route53_zone_id = data.aws_route53_zone.curea.zone_id
}

data "aws_route53_zone" "curea" {
  name         = "curea.co."
  private_zone = false
}

###############################################################################
# Outputs
###############################################################################
output "alb_dns_name" {
  value = module.alb.dns_name
}

output "ecr_repository_urls" {
  value = { for k, r in aws_ecr_repository.this : k => r.repository_url }
}

output "github_actions_role_arn" {
  value = module.github_oidc.role_arn
}

output "rds_secret_arn" {
  value     = module.rds.master_password_arn
  sensitive = true
}
