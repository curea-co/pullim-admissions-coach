import { NextResponse } from 'next/server';

// 가벼운 헬스/구성 체크 — uptime 모니터·배포 후 점검용.
// 진단(analyze)은 admissions 백엔드(pullim-api) 소관으로 이전(ADR-058) — 그 가용성은
// 백엔드 헬스가 답하고, FE 는 자신의 구성(인증 백엔드·API 베이스)만 신호한다.
export const runtime = 'nodejs';
// 항상 최신 구성을 반영하도록 캐시하지 않는다.
export const dynamic = 'force-dynamic';

export function GET() {
  // ⚠️ 비밀/내부 구성 값은 노출하지 않는다 — "설정됐는가"(boolean/enum)만.
  const isProd = process.env.NODE_ENV === 'production';
  const config = {
    authBackend:
      process.env.NEXT_PUBLIC_AUTH_BACKEND === 'pullim' ? 'pullim' : 'mock',
    admissionsApiBase: Boolean(process.env.NEXT_PUBLIC_PULLIM_API),
    osUrl: Boolean(process.env.NEXT_PUBLIC_OS_URL),
  };
  // 프로덕션 준비 신호: 실 인증 + admissions API 베이스 + OS SSO 진입점이 전부 구성됐는가.
  const ready =
    !isProd ||
    (config.authBackend === 'pullim' && config.admissionsApiBase && config.osUrl);

  return NextResponse.json({
    ok: true,
    env: isProd ? 'production' : process.env.NODE_ENV ?? 'unknown',
    ready,
    config,
  });
}
