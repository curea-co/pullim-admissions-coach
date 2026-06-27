import { NextResponse } from 'next/server';

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
  // 프로덕션에서 /api/analyze가 구성됐는지: 필수 env가 모두 *존재*하는지로 판단한다.
  // (특정 백엔드 값에 하드코딩하지 않음 — KV 전환 시에도 유효. 실제 fail-closed 강제는
  // lib/rate-limit/index.ts·route.ts가 담당.)
  const analyzeReady =
    !isProd || (config.aiKey && config.rateLimitIpHeader && config.rateLimitBackend);

  return NextResponse.json({
    ok: true,
    env: isProd ? 'production' : process.env.NODE_ENV ?? 'unknown',
    analyzeReady,
    config,
  });
}
