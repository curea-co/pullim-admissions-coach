import { NextResponse } from 'next/server';
import {
  FEEDBACK_CONTENT_MAX,
  feedbackCategoryLabel,
  feedbackSubmissionSchema,
} from '@pullim/shared';
import { parseWebhookTarget, resolvePublicAddress } from '@/lib/webhook-target';
import { postJsonPinned } from '@/lib/webhook-post';
import {
  FEEDBACK_GLOBAL_KEY,
  FEEDBACK_GLOBAL_RATE_RULES,
  FEEDBACK_RATE_RULES,
  globalRateLimiter,
  rateLimiter,
} from '@/lib/rate-limit';

// 건의하기 수신 라우트 — 모달이 보낸 내용을 **서버 전용** 수집처로 넘긴다.
//
// 왜 same-origin 라우트를 한 겹 두는가: 수집처 URL(FEEDBACK_WEBHOOK_URL)은 사실상 인증 없는
// 쓰기 엔드포인트다. 브라우저에서 직접 부르려면 URL 을 번들에 넣어야 하고, 그러면 누구나 그
// 주소로 무제한 전송할 수 있다. URL 은 서버에만 두고 브라우저는 /api/feedback 만 안다.
//
// ⚠️ 그렇다고 이 라우트가 안전한 건 아니다 — **인증 없이 누구나 부를 수 있다.** URL 을 감춰도
// 공격자는 /api/feedback 을 직접 때려 서버를 외부 발송 프록시로 쓸 수 있다. 그래서 세 겹으로 막는다:
//   ① 호출자 식별자 기준 레이트리밋 — 식별자는 **운영자가 선언한 신뢰 헤더**에서만 얻는다
//   ② 식별자와 무관한 전체 상한(식별자를 갈아 껴도 수집처로 나가는 총량은 고정)
//   ③ 본문 크기 상한을 **스트림을 읽는 도중에** 적용(큰 본문을 메모리에 담기 전에 끊는다)
// 프로덕션에서 ①의 신뢰 헤더나 리미터 백엔드가 구성되지 않으면 열어 두지 않고 503 으로
// 거절한다(fail-closed) — 보호 없이 열린 공개 라우트는 그 순간 외부 발송 프록시다.
// 수집처 주소는 https·비내부 + (선택) 호스트 allowlist + **DNS 해석 결과**까지 확인한다.
//
// 정직성 규칙(§6 — 가짜 상태 금지): **전달에 성공했을 때만 성공을 응답한다.**
// 수집처가 없거나(501) 응답이 실패면(502) 그대로 실패를 돌려준다. 조용히 버리고 200 을
// 주는 구현은 사용자에게 "접수됐다"는 거짓말이 된다.

export const runtime = 'nodejs';
// 매 요청마다 현재 구성(FEEDBACK_WEBHOOK_URL)을 다시 읽어야 한다 — 캐시하지 않는다.
export const dynamic = 'force-dynamic';

/**
 * 본문 크기 상한. 내용 1000자(한글 UTF-8 3바이트 = 3KB)에 JSON 이스케이프·여유를 더한 값이다.
 * 스키마 검증 **이전에** 걸어야 의미가 있다 — 거대한 본문을 파싱하는 비용 자체를 막는 방어다.
 */
const MAX_BODY_BYTES = 8 * 1024;

/** 수집처가 응답하지 않을 때 요청이 매달려 있지 않도록 하는 상한. */
const WEBHOOK_TIMEOUT_MS = 5_000;

function fail(status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, code, message, ...extra }, { status });
}

function rateLimited(retryAfterSec: number) {
  return NextResponse.json(
    {
      ok: false,
      code: 'RATE_LIMITED',
      message: '건의를 너무 자주 보냈습니다. 잠시 뒤에 다시 시도해 주세요.',
    },
    { status: 429, headers: { 'retry-after': String(retryAfterSec) } },
  );
}

/**
 * 프로덕션에서 리미터가 구성되지 않았거나(fail-closed) 저장소에 닿지 못한 경우.
 * 보호 없이 여는 대신 거절한다 — 열어 두면 그 순간 외부 발송 프록시가 된다.
 */
function limiterUnavailable() {
  return fail(
    503,
    'RATE_LIMIT_UNAVAILABLE',
    '남용 방지 장치를 사용할 수 없어 접수를 잠시 중단했습니다. 잠시 뒤 다시 시도해 주세요.',
  );
}

/**
 * 레이트리밋 키(호출자 식별자).
 *
 * `x-forwarded-for` 는 **클라이언트가 직접 넣을 수 있다.** 프록시가 그 값을 덮어쓴다는 보장이
 * 없으면, 매 요청 다른 값을 넣는 것만으로 호출자별 한도가 통째로 무력화된다. 그래서 어떤 헤더를
 * 신뢰할지 코드가 추측하지 않고 **운영자가 선언한다**(TRUSTED_CLIENT_IP_HEADER) — 플랫폼이
 * 값을 보장하는 헤더여야 한다(Vercel `x-vercel-forwarded-for`, Cloudflare `cf-connecting-ip`,
 * 또는 프록시가 덮어쓰는 `x-forwarded-for`).
 *
 * 반환: 식별자 키 / `null` = 프로덕션인데 선언이 없다(= 신뢰할 수 있는 식별자가 없다).
 * 선언된 헤더가 요청에 없으면 예상한 경로로 들어온 요청이 아니므로 **공용 버킷**에 모아 센다.
 */
function callerKey(req: Request): string | null {
  const declared = process.env.TRUSTED_CLIENT_IP_HEADER?.trim();
  if (declared) {
    const value = req.headers.get(declared)?.split(',')[0]?.trim();
    return value ? `feedback:${value}` : 'feedback:untrusted';
  }
  // 프로덕션은 선언을 요구한다 — 추측한 헤더로 도는 보호는 보호가 아니다.
  if (process.env.NODE_ENV === 'production') return null;
  // 개발·테스트 편의: 관용 헤더를 그대로 쓴다(로컬에는 프록시가 없다).
  const dev =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim();
  return `feedback:${dev || 'local'}`;
}

/**
 * 본문을 **읽어 가면서** 상한을 적용한다. `req.text()` 로 통째로 읽은 뒤에 재는 방식은
 * content-length 를 생략·위조한 chunked 요청에 무력하다 — 이미 전부 메모리에 들어온 뒤다.
 * 누적 바이트가 상한을 넘는 순간 스트림을 취소해 나머지를 받지 않는다.
 * 반환: 본문 문자열, 상한 초과면 null.
 */
async function readBoundedText(req: Request, maxBytes: number): Promise<string | null> {
  const stream = req.body;
  if (!stream) {
    // 스트림을 노출하지 않는 런타임 폴백 — 최소한 읽은 뒤에는 잰다.
    const text = await req.text();
    return new TextEncoder().encode(text).byteLength > maxBytes ? null : text;
  }

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel(); // 남은 본문은 받지 않는다 — 여기서 끊는 것이 방어의 핵심이다.
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

export async function POST(req: Request) {
  // ── 1) 본문 크기 — 헤더로 먼저 거른다(읽기 전에 끝낼 수 있는 가장 싼 검사) ──
  // 헤더는 신뢰할 수 없으므로 이것만으로는 부족하다. 실제 방어는 아래 스트림 단계다.
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return fail(
      413,
      'PAYLOAD_TOO_LARGE',
      `보낸 내용이 너무 큽니다. 내용은 ${FEEDBACK_CONTENT_MAX}자 이하로 줄여 주세요.`,
    );
  }

  // ── 2) 호출자별 남용 가드 — 본문을 읽기 전에 건다 ──
  // 순서가 중요하다: 읽고 나서 재면 이미 자원을 쓴 뒤다.
  // (전체 상한은 여기서 보지 않는다 — 아래 6)의 설명 참조.)
  const key = callerKey(req);
  if (key === null) {
    return fail(
      503,
      'CLIENT_IP_SOURCE_NOT_CONFIGURED',
      '호출자를 식별할 신뢰 가능한 경로가 설정되지 않아 접수를 중단했습니다. 운영자가 TRUSTED_CLIENT_IP_HEADER 를 설정해야 합니다.',
    );
  }
  try {
    const caller = await rateLimiter.check(key, FEEDBACK_RATE_RULES);
    if (!caller.allowed) return rateLimited(caller.retryAfterSec);
  } catch {
    return limiterUnavailable();
  }

  // ── 3) 수집처 구성 — 없으면 여기서 끝낸다 ──
  // 검증보다 앞에 두는 이유: 어차피 전달할 수 없는 요청이다. 400 을 돌려주면 사용자는 자기
  // 입력을 고치려 들지만 실제 원인은 서버 구성이다. 원인을 그대로 말한다.
  const allowlist = process.env.FEEDBACK_WEBHOOK_ALLOWED_HOSTS?.trim();
  // 프로덕션은 allowlist 를 **요구한다.** 이름 검사와 DNS 확인만으로는 확인 시점과 연결 시점
  // 사이의 리바인딩을 닫지 못한다(연결을 확인한 IP 에 고정해야 닫힌다). allowlist 를 강제하면
  // 그 경로를 쓰려면 허용된 공급자의 DNS 자체를 장악해야 한다 — 실무에서 이 틈이 닫힌다.
  if (process.env.NODE_ENV === 'production' && !allowlist) {
    return fail(
      501,
      'FEEDBACK_SINK_ALLOWLIST_REQUIRED',
      '수집처 호스트 allowlist 가 설정되지 않아 전송하지 않았습니다. 운영자가 FEEDBACK_WEBHOOK_ALLOWED_HOSTS 를 설정해야 합니다.',
    );
  }
  const sink = parseWebhookTarget(process.env.FEEDBACK_WEBHOOK_URL, allowlist);
  if (!sink) {
    return fail(
      501,
      'FEEDBACK_SINK_NOT_CONFIGURED',
      '건의 내용을 전달할 수집처가 이 환경에 설정되어 있지 않습니다. 운영자가 FEEDBACK_WEBHOOK_URL 을 설정해야 전송됩니다(내부 주소가 아닌 https URL, allowlist 를 켰다면 그 안의 호스트).',
    );
  }

  // 이름이 실제로 가리키는 주소까지 확인하고, **그 주소로 연결한다**(아래 postJsonPinned).
  // 확인만 하고 이름으로 다시 연결하면 그 사이에 응답이 바뀌는 DNS 리바인딩을 막지 못한다.
  const sinkAddress = await resolvePublicAddress(sink.hostname);
  if (!sinkAddress) {
    return fail(
      501,
      'FEEDBACK_SINK_NOT_ALLOWED',
      '설정된 수집처 주소가 내부망을 가리키거나 확인되지 않아 전송하지 않았습니다. 운영자가 FEEDBACK_WEBHOOK_URL 을 확인해야 합니다.',
    );
  }

  // ── 4) 본문 파싱 — 읽어 가면서 상한을 적용한다(content-length 는 없거나 거짓일 수 있다) ──
  let raw: string | null;
  try {
    raw = await readBoundedText(req, MAX_BODY_BYTES);
  } catch {
    return fail(400, 'BODY_READ_FAILED', '요청 본문을 읽지 못했습니다. 다시 시도해 주세요.');
  }
  if (raw === null) {
    return fail(
      413,
      'PAYLOAD_TOO_LARGE',
      `보낸 내용이 너무 큽니다. 내용은 ${FEEDBACK_CONTENT_MAX}자 이하로 줄여 주세요.`,
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return fail(400, 'INVALID_JSON', '요청 본문이 JSON 형식이 아닙니다.');
  }

  // ── 5) 스키마 검증 — 폼과 같은 정의(@pullim/shared) ──
  const parsed = feedbackSubmissionSchema.safeParse(json);
  if (!parsed.success) {
    return fail(400, 'INVALID_BODY', '보낸 내용이 형식에 맞지 않습니다.', {
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  const { category, content } = parsed.data;

  // ── 6) 전체 상한 — **유효한 제출로 확인된 뒤에** 소비한다 ──
  // 이 카운터의 목적은 "수집처로 나가는 총량"을 묶는 것이다. 검증 전에 깎으면, 깨진 JSON 을
  // IP 만 바꿔 가며 보내는 것만으로 전체 quota 를 태워 정상 사용자를 한 시간 막을 수 있다.
  // 유효하지 않은 요청의 비용은 호출자별 한도 + 본문 크기 상한이 이미 묶고 있다.
  try {
    const overall = await globalRateLimiter.check(FEEDBACK_GLOBAL_KEY, FEEDBACK_GLOBAL_RATE_RULES);
    if (!overall.allowed) return rateLimited(overall.retryAfterSec);
  } catch {
    return limiterUnavailable();
  }

  // ── 7) 전달 ──
  // Slack incoming webhook 호환 형태(`{ text }`) 한 가지만 보낸다. 수집처가 모르는 키를
  // 거절하는 경우가 있어 구조화 필드를 덧붙이지 않고, 카테고리는 본문 첫 줄에 적는다.
  const text = [
    `[입시코치 건의] ${feedbackCategoryLabel[category]}`,
    content,
    `— ${new Date().toISOString()}`,
  ].join('\n');

  try {
    // 연결은 위에서 확인한 IP 로 고정한다(TLS 검증은 호스트명 기준 그대로).
    const status = await postJsonPinned(sink, sinkAddress, { text }, {
      timeoutMs: WEBHOOK_TIMEOUT_MS,
    });
    if (status < 200 || status >= 300) {
      // 수집처의 응답 본문은 그대로 흘리지 않는다(내부 주소·토큰이 섞여 나올 수 있다).
      // 3xx 도 여기로 온다 — 리다이렉트를 따라가지 않으므로 성공으로 치지 않는다.
      return fail(
        502,
        'FEEDBACK_SINK_FAILED',
        '수집처가 요청을 받지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
      );
    }
  } catch {
    // 타임아웃·DNS·연결 실패가 모두 여기로 온다. 어느 쪽이든 전달되지 않았다.
    return fail(
      502,
      'FEEDBACK_SINK_UNREACHABLE',
      '수집처에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
    );
  }

  // 202 Accepted — 전달은 됐고, 사람이 읽는 것은 그 뒤의 일이다.
  return NextResponse.json({ ok: true }, { status: 202 });
}
