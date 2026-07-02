import { NextResponse } from 'next/server';

// 가벼운 헬스/구성 체크 — uptime 모니터·배포 후 점검용.
// 진단(analyze)은 admissions 백엔드(pullim-api) 소관으로 이전(ADR-058) — 그 가용성은
// 백엔드 헬스가 답하고, FE 는 자신의 구성(인증 백엔드·API 베이스)만 신호한다.
export const runtime = 'nodejs';
// 항상 최신 구성을 반영하도록 캐시하지 않는다.
export const dynamic = 'force-dynamic';

/** 존재 + URL 형식 유효(스킴 포함)까지 판정 — 실제 소비부(osLoginHref·createApiClient)와 어긋나지 않게. */
function isValidUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false; // 스킴 누락('api.pullim.ai') 등 — 소비부가 폴백/오동작하므로 ready 로 치지 않는다.
  }
}

export function GET() {
  // ⚠️ 비밀/내부 구성 값은 노출하지 않는다 — "설정됐는가"(boolean/enum)만.
  const isProd = process.env.NODE_ENV === 'production';
  const config = {
    authBackend:
      process.env.NEXT_PUBLIC_AUTH_BACKEND === 'pullim' ? 'pullim' : 'mock',
    admissionsApiBase: isValidUrl(process.env.NEXT_PUBLIC_PULLIM_API),
    osUrl: isValidUrl(process.env.NEXT_PUBLIC_OS_URL),
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
