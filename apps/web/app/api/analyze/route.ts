import { NextResponse } from 'next/server';
import { studentProfileSchema } from '@pullim/shared';
import {
  rateLimiter,
  ANALYZE_RATE_RULES,
  MAX_SAENGBU_CHARS,
} from '@/lib/rate-limit';

export const runtime = 'nodejs';
// opus 풀 파이프라인(3~4콜 ≈ 30~90초)용 한도.
// 주의(배포): Vercel Hobby는 60초로 클램프되어 이 값을 무시함 → Pro/Fluid 필요.
// twin 경로 등으로 초과 위험이 있으므로, 프로덕션 정답은 동기 호출이 아닌 잡큐(후속 P0).
export const maxDuration = 300;

/**
 * 클라이언트 IP(레이트리밋 키).
 * 신뢰 프록시(예: Vercel 엣지)가 덮어쓴 x-forwarded-for 첫 홉을 사용한다.
 * 주의: 신뢰 프록시 뒤가 아닌 배포에서는 클라이언트가 이 헤더를 위조해 IP 제한을
 * 우회할 수 있다 → 자가 호스팅 시 반드시 신뢰 프록시가 붙인 값만 통과시키도록
 * 인프라(WAF/프록시)에서 보장할 것(RELEASE-HANDOFF §5). 정확한 분산 제한은
 * 공유 스토어(KV) 어댑터 + 플랫폼 보장 IP로 강화한다.
 */
function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

export async function POST(req: Request) {
  // 남용 가드(스펙 §8): 인증 전 무차별 호출 + opus 과금 폭증 차단.
  // mock·실 분기 이전에 적용해 데모 경로도 일관 보호.
  const ip = clientIp(req);
  const rl = await rateLimiter.check(ip, ANALYZE_RATE_RULES);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: '요청이 많습니다. 잠시 후 다시 시도해 주세요.', retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });
  }

  const v = studentProfileSchema.safeParse(payload);
  if (!v.success) {
    return NextResponse.json({ error: '입력 검증 실패' }, { status: 400 });
  }

  // 입력 길이 가드: 생기부 본문 베타 상한(opus 비용/지연).
  if (v.data.record.inputType === 'text_paste' && v.data.record.text.length > MAX_SAENGBU_CHARS) {
    return NextResponse.json(
      { error: `생기부 본문이 너무 깁니다(최대 ${MAX_SAENGBU_CHARS.toLocaleString()}자). 핵심 항목 위주로 줄여주세요.` },
      { status: 413 }
    );
  }

  // mock 폴백: 키 없으면 데모 결과
  if (!process.env.ANTHROPIC_API_KEY) {
    const { mockAnalyzeResult } = await import('@/lib/mock/analyze-mock');
    return NextResponse.json({ result: mockAnalyzeResult(v.data), demo: true });
  }

  const { analyze } = await import('@/lib/analyze'); // server-only 동적 import
  const { toAnalysisInput } = await import('@/lib/profile-adapter');

  // 입력 변환 실패 = 잘못된 요청(4xx). 상세 사유는 클라이언트에 노출하지 않는다.
  let profile;
  try {
    profile = toAnalysisInput(v.data);
  } catch (err) {
    console.error('[analyze] 입력 어댑터 오류:', err);
    return NextResponse.json(
      { error: '입력을 분석할 수 없습니다. 입력 내용을 확인해 주세요.' },
      { status: 400 }
    );
  }

  try {
    const result = await analyze(profile);
    return NextResponse.json({ result, demo: false });
  } catch (err) {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    if (err instanceof Anthropic.APIError) {
      const status = err.status === 529 || err.status === 429 ? 503 : 502;
      return NextResponse.json(
        { error: 'AI 서비스가 혼잡합니다. 잠시 후 다시 시도해 주세요.' },
        { status }
      );
    }
    // 내부 오류: 상세(err.message·SDK 문구·스택)는 서버 로그로만, 클라엔 일반 메시지 + 5xx.
    console.error('[analyze] 내부 오류:', err);
    return NextResponse.json(
      { error: '분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    );
  }
}
