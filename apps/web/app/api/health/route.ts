import { NextResponse } from 'next/server';
import { rateLimitConfigError } from '@/lib/rate-limit';

// 가벼운 헬스/구성 체크 — uptime 모니터·배포 후 점검용. opus 호출 없음(무료·즉시).
// /api/analyze는 핑 1회에 opus 풀 파이프라인이라 모니터링에 부적합 → 이 엔드포인트 사용.
export const runtime = 'nodejs';
// 항상 최신 구성을 반영하도록 캐시하지 않는다.
export const dynamic = 'force-dynamic';

export function GET() {
  // ⚠️ 비밀/내부 구성 값은 노출하지 않는다 — "설정됐는가"(boolean)만.
  // (rateLimitBackend의 실제 값 'memory'/'upstash' 등도 운영 구성이므로 boolean으로만 노출.)
  // 배포 직후 구성 누락(키 이름 오타 등)을 즉시 식별하기 위한 운영 신호.
  const isProd = process.env.NODE_ENV === 'production';
  const config = {
    aiKey: Boolean(process.env.ANTHROPIC_API_KEY),
    rateLimitIpHeader: Boolean(process.env.RATE_LIMIT_IP_HEADER),
    rateLimitBackend: Boolean(process.env.RATE_LIMIT_BACKEND),
    authBackend: process.env.NEXT_PUBLIC_AUTH_BACKEND === 'pullim' ? 'pullim' : 'mock',
  };
  // 프로덕션에서 /api/analyze가 구성됐는지(config-level 신호): 키·신뢰 IP 헤더 env가
  // 존재하고, 레이트리밋 백엔드가 **리미터가 실제로 수용하는** 구성인지.
  // 백엔드 판정은 리미터와 동일한 단일 소스(rateLimitConfigError)를 써서 어긋나지 않게 한다
  // — KV 전환 시 그 함수만 바꾸면 health도 자동 반영. (per-request IP 헤더 비어있음 같은
  // 런타임 조건은 요청 시점에 clientIp가 강제하므로 config 신호 범위 밖.)
  const analyzeReady =
    !isProd ||
    (config.aiKey && config.rateLimitIpHeader && rateLimitConfigError() === null);

  return NextResponse.json({
    ok: true,
    env: isProd ? 'production' : process.env.NODE_ENV ?? 'unknown',
    analyzeReady,
    config,
  });
}
