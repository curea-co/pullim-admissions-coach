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
 *
 * 보안: 클라이언트가 임의로 넣을 수 있는 헤더를 신뢰하면 IP 제한이 우회되어 비용
 * 보호가 깨진다. 그래서 신뢰할 IP 헤더를 명시(`RATE_LIMIT_IP_HEADER`)하게 한다 —
 * 신뢰 프록시(엣지/WAF)가 위조 불가하게 덮어쓰는 헤더(예: Vercel `x-forwarded-for`)만
 * 지정해야 한다(RELEASE-HANDOFF §5).
 *  - 프로덕션: `RATE_LIMIT_IP_HEADER` 미설정이면 신뢰 가능한 IP를 알 수 없으므로
 *    **fail-closed**(throw → 라우트 500). 임의 헤더를 조용히 신뢰하지 않는다.
 *  - 개발/테스트: 기본 `x-forwarded-for` 사용(편의).
 */
function clientIp(req: Request): string {
  const headerName = process.env.RATE_LIMIT_IP_HEADER;
  const isProd = process.env.NODE_ENV === 'production';

  if (headerName) {
    // 신뢰 헤더를 명시한 경우 **그 헤더만** 사용한다. 비어 있어도 spoofable 헤더로
    // 폴백하지 않는다(폴백은 fail-open이 되어 우회를 허용).
    const raw = req.headers.get(headerName);
    if (raw && raw.trim()) return raw.split(',')[0]!.trim();
    if (isProd) {
      throw new Error(
        `신뢰 IP 헤더(${headerName})가 비어 있습니다(프로덕션 fail-closed). 엣지/프록시 설정을 확인하세요.`
      );
    }
    return 'unknown'; // 개발/테스트: 차단 대신 단일 키로 묶음.
  }

  // 헤더 미설정: 프로덕션은 임의 헤더를 신뢰하지 않고 fail-closed.
  if (isProd) {
    throw new Error(
      'RATE_LIMIT_IP_HEADER 미설정: 프로덕션에서는 신뢰 프록시가 보장하는 IP 헤더를 ' +
        '명시해야 합니다(임의 헤더 신뢰 = IP 제한 우회). RELEASE-HANDOFF §5 참고.'
    );
  }
  // 개발/테스트 편의: 표준 헤더 사용(프로덕션 경로 아님).
  const dev = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  return dev ? dev.split(',')[0]!.trim() : 'unknown';
}

export async function POST(req: Request) {
  // 남용 가드(스펙 §8): 인증 전 무차별 호출 + opus 과금 폭증 차단.
  // mock·실 분기 이전에 적용해 데모 경로도 일관 보호.
  // 레이트리밋 IP/백엔드 미구성(프로덕션 fail-closed)은 일반 500으로 처리하고
  // 상세 설정 사유는 서버 로그로만 남긴다.
  let rl;
  try {
    const ip = clientIp(req);
    rl = await rateLimiter.check(ip, ANALYZE_RATE_RULES);
  } catch (err) {
    console.error('[analyze] 레이트리밋 구성 오류:', err);
    return NextResponse.json(
      { error: '일시적으로 요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    );
  }
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

  // mock 폴백: 키 없으면 데모 결과.
  // 단, 프로덕션에서 키 누락이 200+demo로 숨겨지면 설정 누락이 정상 응답처럼 보여
  // 장애 감지가 늦는다 → 프로덕션은 기본 fail-loud(503). 스테이징 등에서 의도적으로
  // 데모를 켜려면 ALLOW_DEMO_FALLBACK=1 로 명시 옵트인.
  if (!process.env.ANTHROPIC_API_KEY) {
    const demoAllowed =
      process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEMO_FALLBACK === '1';
    if (!demoAllowed) {
      console.error('[analyze] ANTHROPIC_API_KEY 미설정(프로덕션, 데모 비허용) — 503');
      return NextResponse.json(
        { error: '서비스가 일시적으로 불가합니다. 잠시 후 다시 시도해 주세요.' },
        { status: 503 }
      );
    }
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
    // §6 전 출력 린트: 게이트 밖 섹션의 금지 키워드를 모니터링 로그로 표면화(비차단).
    // 생기부 원문/PII는 로그에 남기지 않고 위치·키워드만 남긴다.
    if (result.guardrailFlags?.length) {
      console.warn(
        '[analyze] §6 guardrail flags:',
        result.guardrailFlags.map((f) => `${f.keyword}@${f.path}`).join(', ')
      );
    }
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
