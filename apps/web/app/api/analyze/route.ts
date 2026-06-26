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

/** 프록시 체인의 첫 홉을 클라이언트 IP로 사용(없으면 unknown). */
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

  try {
    const { analyze } = await import('@/lib/analyze'); // server-only 동적 import
    const { toAnalysisInput } = await import('@/lib/profile-adapter');
    const profile = toAnalysisInput(v.data);
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '분석 실패' },
      { status: 400 }
    );
  }
}
