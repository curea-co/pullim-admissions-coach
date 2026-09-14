import { NextResponse } from 'next/server';
import { FEEDBACK_CONTENT_MAX, feedbackSubmissionSchema } from '@pullim/shared';
import {
  FEEDBACK_USER_AGENT_MAX,
  appVersion,
  postFeedbackToApi,
  resolveFeedbackApiTarget,
  resolveUserId,
  type FeedbackApiPayload,
} from '@/lib/feedback-api';
import {
  FEEDBACK_GLOBAL_KEY,
  FEEDBACK_GLOBAL_RATE_RULES,
  FEEDBACK_RATE_RULES,
  globalRateLimiter,
  rateLimiter,
} from '@/lib/rate-limit';

// 건의하기 수신 라우트 — 모달이 보낸 내용을 pullim-api 에 **저장한다**(운영은 pullim-admin
// 에서 읽는다). 알림만 던지고 마는 경로는 지나가면 사라져 그 목적을 못 채운다.
//
// 왜 same-origin 라우트를 한 겹 두는가: 저장 표면(PULLIM_API_URL + FEEDBACK_SERVICE_KEY)은
// 서비스 키 하나로 쓰는 엔드포인트다. 브라우저에서 직접 부르려면 키를 번들에 넣어야 하고,
// 그러면 누구나 그 키로 무제한 전송할 수 있다. 키는 서버에만 두고 브라우저는 /api/feedback 만 안다.
//
// ⚠️ 그렇다고 이 라우트가 안전한 건 아니다 — **인증 없이 누구나 부를 수 있다.** 키를 감춰도
// 공격자는 /api/feedback 을 직접 때려 서버를 외부 발송 프록시로 쓸 수 있다. 그래서 세 겹으로 막는다:
//   ① 호출자 식별자 기준 레이트리밋 — 식별자는 **운영자가 선언한 신뢰 헤더**에서만 얻는다
//   ② 식별자와 무관한 전체 상한(식별자를 갈아 껴도 api 로 나가는 총량은 고정)
//   ③ 본문 크기 상한을 **스트림을 읽는 도중에** 적용(큰 본문을 메모리에 담기 전에 끊는다)
// 프로덕션에서 ①의 신뢰 헤더나 리미터 백엔드가 구성되지 않으면 열어 두지 않고 503 으로
// 거절한다(fail-closed) — 보호 없이 열린 공개 라우트는 그 순간 외부 발송 프록시다.
//
// 저장 값의 경계(오너 결정): 담기는 신원은 **userId 하나뿐**이고 그 값도 서버가 정한다.
// 이름·이메일·등급·미성년 여부는 보내지 않는다(lib/feedback-api.ts 의 payload 타입이 경계다).
//
// 정직성 규칙(§6 — 가짜 상태 금지): **저장에 성공했을 때만 성공을 응답한다.**
// 구성이 없거나(501) api 가 받지 못하면(502) 그대로 실패를 돌려준다. 조용히 버리고 200 을
// 주는 구현은 사용자에게 "접수됐다"는 거짓말이 된다.

export const runtime = 'nodejs';
// 매 요청마다 현재 구성(PULLIM_API_URL·FEEDBACK_SERVICE_KEY)을 다시 읽어야 한다 — 캐시하지 않는다.
export const dynamic = 'force-dynamic';

/**
 * 본문 크기 상한. 내용 1000자(한글 UTF-8 3바이트 = 3KB)에 JSON 이스케이프·여유를 더한 값이다.
 * 스키마 검증 **이전에** 걸어야 의미가 있다 — 거대한 본문을 파싱하는 비용 자체를 막는 방어다.
 */
const MAX_BODY_BYTES = 8 * 1024;

/** api 가 응답하지 않을 때 요청이 매달려 있지 않도록 하는 상한. */
const API_TIMEOUT_MS = 5_000;

/**
 * 신원 확인(`GET /me`)의 상한. 저장보다 짧게 둔다 — 이건 **있으면 좋은 값**이라, 여기서 오래
 * 기다리다 사용자의 건의를 놓치는 쪽이 더 나쁘다.
 */
const IDENTITY_TIMEOUT_MS = 2_000;

/**
 * 본문을 다 받기까지의 상한. 크기만 재고 시간을 재지 않으면, 연결만 잡고 본문을 보내지 않는
 * 요청이 여기서 무기한 대기한다(slow loris) — 공개 라우트에서는 그게 곧 워커·연결 고갈이다.
 */
const BODY_READ_TIMEOUT_MS = 5_000;

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
 * 이 요청이 우리 화면에서 온 것인가(교차 출처 차단).
 *
 * 인증이 없는 라우트라 CSRF 토큰이 없다. 그대로 두면 공격 사이트가 방문자 브라우저로 이 주소에
 * POST 해서 **피해자 IP 의 버킷을 대신 소모**시킬 수 있다(방문자를 여러 명 모으면 호출자별
 * 한도를 우회한다). 브라우저가 스스로 붙이는 신호로 막는다:
 *   - `Sec-Fetch-Site`: 최신 브라우저가 항상 붙이고 **스크립트가 위조할 수 없다.**
 *   - `Origin`: 교차 출처 POST 에는 반드시 붙는다(구형 폴백).
 * 둘 다 없으면 브라우저發이 아니므로 여기서는 판단하지 않는다(그런 호출은 레이트리밋 소관).
 */
function isSameOriginRequest(req: Request): boolean {
  const site = req.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin' || site === 'none';
  const origin = req.headers.get('origin');
  if (origin) {
    try {
      // **스킴까지** 비교한다 — host 만 보면 `http://example.com` 이 `https://example.com` 의
      // 요청으로 통과한다(둘은 서로 다른 origin 이다).
      return new URL(origin).origin === expectedOrigin(req);
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * 클라이언트가 본 우리 origin. TLS 종단이 프록시에 있으면 서버가 보는 `req.url` 은 http 라서
 * 그대로 비교하면 정상 요청이 스킴 불일치로 막힌다 — 프록시가 넘긴 값을 먼저 본다.
 * (이 헤더들은 브라우저가 붙일 수 없다: fetch 로 임의 헤더를 붙이면 프리플라이트가 필요해지고,
 *  이 라우트는 CORS 헤더를 내보내지 않아 교차 출처에서는 그 단계에서 막힌다.)
 */
function expectedOrigin(req: Request): string {
  const url = new URL(req.url);
  const first = (value: string) => value.split(',')[0].trim();
  const proto = first(req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', ''));
  const host = first(
    req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? url.host,
  );
  // URL 로 한 번 돌려 기본 포트 표기를 양쪽 모두 정규화한다(https://h:443 → https://h).
  return new URL(`${proto}://${host}`).origin;
}

/**
 * 저장할 맥락을 만든다. **서버가 아는 값은 서버가 채운다** — user-agent 는 요청 헤더에서 읽고
 * (클라이언트가 보낸 값보다 신뢰도가 높다), 빌드 식별자는 배포 환경에서 읽는다.
 * 모르는 값은 **필드째 생략한다**(빈 문자열·'unknown' 같은 가짜 값을 저장하지 않는다).
 */
function buildContext(
  req: Request,
  client: { pageUrl: string; viewport: { w: number; h: number } } | undefined,
): FeedbackApiPayload['context'] {
  const userAgent = req.headers.get('user-agent')?.trim().slice(0, FEEDBACK_USER_AGENT_MAX);
  const version = appVersion();
  return {
    ...(client ? { pageUrl: client.pageUrl } : {}),
    ...(userAgent ? { userAgent } : {}),
    ...(client ? { viewport: client.viewport } : {}),
    ...(version ? { appVersion: version } : {}),
  };
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
type BoundedRead =
  | { ok: true; text: string }
  | { ok: false; reason: 'too-large' | 'timeout' | 'unreadable' };

async function readBoundedText(
  req: Request,
  maxBytes: number,
  timeoutMs: number,
): Promise<BoundedRead> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  // 전체 읽기에 걸리는 하나의 마감 — 청크마다 갱신되면 천천히 흘리는 요청을 영원히 기다린다.
  const deadline = new Promise<'deadline'>((resolve) => {
    timer = setTimeout(() => resolve('deadline'), timeoutMs);
  });

  try {
    const stream = req.body;
    if (!stream) {
      // 스트림을 노출하지 않는 런타임 폴백 — 최소한 읽은 뒤에는 잰다.
      const raced = await Promise.race([req.text().catch(() => null), deadline]);
      if (raced === 'deadline') return { ok: false, reason: 'timeout' };
      if (raced === null) return { ok: false, reason: 'unreadable' };
      return new TextEncoder().encode(raced).byteLength > maxBytes
        ? { ok: false, reason: 'too-large' }
        : { ok: true, text: raced };
    }

    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      for (;;) {
        const next = await Promise.race([reader.read(), deadline]);
        if (next === 'deadline') {
          await reader.cancel();
          return { ok: false, reason: 'timeout' };
        }
        const { done, value } = next;
        if (done) break;
        if (!value) continue;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel(); // 남은 본문은 받지 않는다 — 여기서 끊는 것이 방어의 핵심이다.
          return { ok: false, reason: 'too-large' };
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
    return { ok: true, text: new TextDecoder().decode(merged) };
  } finally {
    clearTimeout(timer);
  }
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

  // ── 1.5) 교차 출처 차단 — **레이트리밋보다 먼저.** ──
  // 남의 사이트가 방문자 브라우저로 보낸 요청이 피해자의 버킷을 소모하면 안 된다.
  if (!isSameOriginRequest(req)) {
    return fail(
      403,
      'CROSS_ORIGIN_REJECTED',
      '다른 사이트에서 보낸 요청은 접수하지 않습니다.',
    );
  }
  // JSON 만 받는다. `text/plain` 등을 허용하면 CORS 프리플라이트 없이 보낼 수 있는
  // "simple request" 가 되어 교차 출처 POST 가 그대로 들어온다.
  // 정확히 일치를 본다 — startsWith 면 `application/jsonp`·`application/json-seq` 처럼
  // JSON 이 아닌 타입까지 통과한다.
  const mediaType = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (mediaType !== 'application/json') {
    return fail(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      '요청 본문은 application/json 이어야 합니다.',
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

  // ── 3) 저장 대상(pullim-api) 구성 — 없으면 여기서 끝낸다 ──
  // 검증보다 앞에 두는 이유: 어차피 저장할 수 없는 요청이다. 400 을 돌려주면 사용자는 자기
  // 입력을 고치려 들지만 실제 원인은 서버 구성이다. 원인을 그대로 말한다.
  const resolved = resolveFeedbackApiTarget();
  if (!resolved.ok) {
    if (resolved.reason === 'not-configured') {
      return fail(
        501,
        'FEEDBACK_SINK_NOT_CONFIGURED',
        `건의를 저장할 곳이 이 환경에 설정되어 있지 않습니다. 운영자가 ${resolved.missing.join(
          '·',
        )} 를 설정해야 접수됩니다.`,
      );
    }
    return fail(
      501,
      'FEEDBACK_SINK_NOT_ALLOWED',
      resolved.reason === 'insecure'
        ? '저장 주소가 평문 http 라 서비스 키를 보낼 수 없어 접수하지 않았습니다. 운영자가 PULLIM_API_URL 을 https 로 설정해야 합니다(http 는 localhost 등 loopback 주소에서만 허용).'
        : '저장 주소(PULLIM_API_URL)가 올바른 http(s) 주소가 아니라 접수하지 않았습니다. 운영자가 값을 확인해야 합니다.',
    );
  }
  const target = resolved.target;

  // ── 4) 본문 파싱 — 읽어 가면서 상한을 적용한다(content-length 는 없거나 거짓일 수 있다) ──
  let read: BoundedRead;
  try {
    read = await readBoundedText(req, MAX_BODY_BYTES, BODY_READ_TIMEOUT_MS);
  } catch {
    return fail(400, 'BODY_READ_FAILED', '요청 본문을 읽지 못했습니다. 다시 시도해 주세요.');
  }
  if (!read.ok) {
    if (read.reason === 'timeout') {
      // 연결만 잡고 본문을 보내지 않는 요청 — 기다려 주지 않는다.
      return fail(408, 'BODY_READ_TIMEOUT', '요청 본문이 제한 시간 안에 도착하지 않았습니다.');
    }
    if (read.reason === 'unreadable') {
      return fail(400, 'BODY_READ_FAILED', '요청 본문을 읽지 못했습니다. 다시 시도해 주세요.');
    }
    return fail(
      413,
      'PAYLOAD_TOO_LARGE',
      `보낸 내용이 너무 큽니다. 내용은 ${FEEDBACK_CONTENT_MAX}자 이하로 줄여 주세요.`,
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(read.text);
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
  const { category, content, context } = parsed.data;

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

  // ── 7) 저장 ──
  // 신원은 **여기서** 정한다 — 클라이언트가 보낸 id 는 읽지도 않는다(스키마에 그런 필드가 없다).
  // 확인되지 않으면 null 이고, 그래도 건의는 저장된다(신원은 있으면 좋은 값이다).
  const userId = await resolveUserId(req.headers.get('cookie'), target, {
    timeoutMs: IDENTITY_TIMEOUT_MS,
  });

  const payload: FeedbackApiPayload = {
    service: 'admissions',
    category,
    content,
    userId,
    context: buildContext(req, context),
  };

  try {
    const status = await postFeedbackToApi(target, payload, { timeoutMs: API_TIMEOUT_MS });
    if (status < 200 || status >= 300) {
      // api 의 응답 본문은 그대로 흘리지 않는다(내부 주소·토큰이 섞여 나올 수 있다).
      // 3xx 도 여기로 온다 — 리다이렉트를 따라가지 않으므로 성공으로 치지 않는다.
      return fail(
        502,
        'FEEDBACK_SINK_FAILED',
        '건의를 저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
      );
    }
  } catch {
    // 타임아웃·DNS·연결 실패가 모두 여기로 온다. 어느 쪽이든 저장되지 않았다.
    return fail(
      502,
      'FEEDBACK_SINK_UNREACHABLE',
      '건의를 저장할 서버에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
    );
  }

  // 202 Accepted — 저장은 됐고, 사람이 읽는 것은 그 뒤의 일이다.
  // (api 가 돌려주는 id 는 화면에 쓰지 않으므로 흘리지 않는다 — 표시하지 않을 값을 노출하지 않는다.)
  return NextResponse.json({ ok: true }, { status: 202 });
}
