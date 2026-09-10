import { NextResponse } from 'next/server';
import {
  FEEDBACK_CONTENT_MAX,
  feedbackCategoryLabel,
  feedbackSubmissionSchema,
} from '@pullim/shared';

// 건의하기 수신 라우트 — 모달이 보낸 내용을 **서버 전용** 수집처로 넘긴다.
//
// 왜 same-origin 라우트를 한 겹 두는가: 수집처 URL(FEEDBACK_WEBHOOK_URL)은 사실상 인증 없는
// 쓰기 엔드포인트다. 브라우저에서 직접 부르려면 URL 을 번들에 넣어야 하고, 그러면 누구나 그
// 주소로 무제한 전송할 수 있다. URL 은 서버에만 두고 브라우저는 /api/feedback 만 안다.
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

export async function POST(req: Request) {
  // ── 1) 본문 크기 — 헤더로 먼저 거른다(읽기 전에 끝낼 수 있는 가장 싼 검사) ──
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return fail(
      413,
      'PAYLOAD_TOO_LARGE',
      `보낸 내용이 너무 큽니다. 내용은 ${FEEDBACK_CONTENT_MAX}자 이하로 줄여 주세요.`,
    );
  }

  // ── 2) 수집처 구성 — 없으면 여기서 끝낸다 ──
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

  // ── 3) 본문 파싱 — content-length 가 없거나 거짓말일 수 있어 실제 길이도 확인한다 ──
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return fail(400, 'BODY_READ_FAILED', '요청 본문을 읽지 못했습니다. 다시 시도해 주세요.');
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
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

  // ── 4) 스키마 검증 — 폼과 같은 정의(@pullim/shared) ──
  const parsed = feedbackSubmissionSchema.safeParse(json);
  if (!parsed.success) {
    return fail(400, 'INVALID_BODY', '보낸 내용이 형식에 맞지 않습니다.', {
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  const { category, content } = parsed.data;

  // ── 5) 전달 ──
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
