import { NextResponse } from 'next/server';
import {
  FEEDBACK_CONTENT_MAX,
  feedbackCategoryLabel,
  feedbackSubmissionSchema,
} from '@pullim/shared';
import {
  FEEDBACK_GLOBAL_KEY,
  FEEDBACK_GLOBAL_RATE_RULES,
  FEEDBACK_RATE_RULES,
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
//   ① 호출자 식별자(IP) 기준 레이트리밋  ② 식별자와 무관한 전체 상한(IP 를 갈아 껴도 총량은 고정)
//   ③ 본문 크기 상한을 **스트림을 읽는 도중에** 적용(큰 본문을 메모리에 담기 전에 끊는다)
// 프로덕션에서 리미터가 구성되지 않으면 열어 두지 않고 503 으로 거절한다(fail-closed).
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

/** 스킴까지 유효한 URL 인가 — 형식이 깨진 값은 "설정되지 않음"과 같이 취급한다(health 와 동일 판정). */
function isValidUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * 레이트리밋 키(호출자 식별자). 프록시 뒤에서는 `x-forwarded-for` 의 첫 항목이 클라이언트다.
 * ⚠️ 이 헤더는 프록시 구성에 따라 **위조될 수 있다** — 그래서 이 키에만 의존하지 않고
 * 식별자와 무관한 전체 상한(FEEDBACK_GLOBAL_RATE_RULES)을 함께 건다.
 */
function callerKey(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const real = req.headers.get('x-real-ip')?.trim();
  return `feedback:${forwarded || real || 'unknown'}`;
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

  // ── 2) 남용 가드 — 본문을 읽기 전에 건다 ──
  // 순서가 중요하다: 읽고 나서 재면 이미 자원을 쓴 뒤다. 호출자별 한도와 전체 상한을 둘 다 본다.
  try {
    // 호출자 한도를 **먼저** 본다. 순서를 바꿔 둘을 동시에 소비하면, 한 IP 가 계속 막히면서도
    // 전체 상한을 갉아먹어 결국 모두를 막는 자해가 된다(막힌 요청은 전체 카운터를 쓰지 않는다).
    const caller = await rateLimiter.check(callerKey(req), FEEDBACK_RATE_RULES);
    const blocked = caller.allowed
      ? await rateLimiter
          .check(FEEDBACK_GLOBAL_KEY, FEEDBACK_GLOBAL_RATE_RULES)
          .then((r) => (r.allowed ? null : r))
      : caller;
    if (blocked) {
      return NextResponse.json(
        {
          ok: false,
          code: 'RATE_LIMITED',
          message: '건의를 너무 자주 보냈습니다. 잠시 뒤에 다시 시도해 주세요.',
        },
        { status: 429, headers: { 'retry-after': String(blocked.retryAfterSec) } },
      );
    }
  } catch {
    // 프로덕션에서 리미터가 구성되지 않았거나(fail-closed) 저장소에 닿지 못한 경우.
    // 보호 없이 여는 대신 거절한다 — 열어 두면 그 순간 외부 발송 프록시가 된다.
    return fail(
      503,
      'RATE_LIMIT_UNAVAILABLE',
      '남용 방지 장치를 사용할 수 없어 접수를 잠시 중단했습니다. 잠시 뒤 다시 시도해 주세요.',
    );
  }

  // ── 3) 수집처 구성 — 없으면 여기서 끝낸다 ──
  // 검증보다 앞에 두는 이유: 어차피 전달할 수 없는 요청이다. 400 을 돌려주면 사용자는 자기
  // 입력을 고치려 들지만 실제 원인은 서버 구성이다. 원인을 그대로 말한다.
  const webhookUrl = process.env.FEEDBACK_WEBHOOK_URL;
  if (!isValidUrl(webhookUrl)) {
    return fail(
      501,
      'FEEDBACK_SINK_NOT_CONFIGURED',
      '건의 내용을 전달할 수집처가 이 환경에 설정되어 있지 않습니다. 운영자가 FEEDBACK_WEBHOOK_URL 을 설정해야 전송됩니다.',
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

  // ── 6) 전달 ──
  // Slack incoming webhook 호환 형태(`{ text }`) 한 가지만 보낸다. 수집처가 모르는 키를
  // 거절하는 경우가 있어 구조화 필드를 덧붙이지 않고, 카테고리는 본문 첫 줄에 적는다.
  const text = [
    `[입시코치 건의] ${feedbackCategoryLabel[category]}`,
    content,
    `— ${new Date().toISOString()}`,
  ].join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    const res = await fetch(webhookUrl as string, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) {
      // 수집처의 응답 본문은 그대로 흘리지 않는다(내부 주소·토큰이 섞여 나올 수 있다).
      return fail(
        502,
        'FEEDBACK_SINK_FAILED',
        '수집처가 요청을 받지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
      );
    }
  } catch {
    // 타임아웃(abort)·DNS·연결 실패가 모두 여기로 온다. 어느 쪽이든 전달되지 않았다.
    return fail(
      502,
      'FEEDBACK_SINK_UNREACHABLE',
      '수집처에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
    );
  } finally {
    clearTimeout(timer);
  }

  // 202 Accepted — 전달은 됐고, 사람이 읽는 것은 그 뒤의 일이다.
  return NextResponse.json({ ok: true }, { status: 202 });
}
