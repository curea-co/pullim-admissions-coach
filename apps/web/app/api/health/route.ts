import { NextResponse } from 'next/server';

// 가벼운 헬스/구성 체크 — uptime 모니터·배포 후 점검용. opus 호출 없음(무료·즉시).
// /api/analyze는 핑 1회에 opus 풀 파이프라인이라 모니터링에 부적합 → 이 엔드포인트 사용.
export const runtime = 'nodejs';
// 항상 최신 구성을 반영하도록 캐시하지 않는다.
export const dynamic = 'force-dynamic';

export function GET() {
  // ⚠️ 비밀 값은 절대 노출하지 않는다 — "설정됐는가"(boolean)만.
  // 배포 직후 구성 누락(키 이름 오타 등)을 즉시 식별하기 위한 운영 신호.
  const isProd = process.env.NODE_ENV === 'production';
  const config = {
    aiKey: Boolean(process.env.ANTHROPIC_API_KEY),
    rateLimitIpHeader: Boolean(process.env.RATE_LIMIT_IP_HEADER),
    rateLimitBackend: process.env.RATE_LIMIT_BACKEND ?? null,
    authBackend: process.env.NEXT_PUBLIC_AUTH_BACKEND === 'pullim' ? 'pullim' : 'mock',
  };
  // 프로덕션에서 /api/analyze가 정상 동작하려면 아래가 모두 충족돼야 한다(없으면 fail-closed).
  const analyzeReady =
    !isProd ||
    (config.aiKey && config.rateLimitIpHeader && config.rateLimitBackend === 'memory');

  return NextResponse.json({
    ok: true,
    env: isProd ? 'production' : process.env.NODE_ENV ?? 'unknown',
    analyzeReady,
    config,
  });
}
