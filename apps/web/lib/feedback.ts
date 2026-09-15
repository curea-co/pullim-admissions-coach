// 건의하기 — 노출 플래그 + 전송 클라이언트.
//
// 전송은 same-origin `/api/feedback` 한 곳으로만 간다. 저장 주소·서비스 키는 서버 전용이라
// 브라우저는 그 값을 알지 못한다(app/api/feedback/route.ts 주석 참조).
//
// 오류 문구 원칙(§6): **원인 + 사용자가 할 수 있는 것**을 말한다. "실패했습니다" 같은 빈 문장이나,
// 전송되지 않았는데 완료 화면으로 넘기는 위장은 하지 않는다.

import {
  FEEDBACK_PAGE_URL_MAX,
  feedbackClientContextSchema,
  feedbackSubmissionSchema,
  type FeedbackClientContext,
  type FeedbackSubmission,
} from '@pullim/shared';

/**
 * FAB 노출 여부. **함수 안에서** env 를 읽는다 — 모듈 상수로 굳히면 테스트의 `vi.stubEnv` 가
 * 먹지 않는다(lib/dev-bypass.ts·lib/pullim-services.ts 와 같은 규칙).
 * `NEXT_PUBLIC_*` 는 빌드타임 인라인이므로 리터럴 접근이어야 한다.
 */
export function isFeedbackEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FEEDBACK_ENABLED === 'true';
}

export type FeedbackSendResult = { ok: true } | { ok: false; message: string };

const MESSAGE = {
  notConfigured:
    '지금은 건의를 받을 창구가 서버에 연결되어 있지 않아 보내지 못했어요. 운영 설정이 필요한 문제라, 잠시 뒤 다시 시도해 주세요.',
  tooLong: '내용이 너무 길어 보내지 못했어요. 1000자 이하로 줄여서 다시 보내 주세요.',
  invalid: '보낸 내용이 형식에 맞지 않아 접수되지 않았어요. 내용을 1자 이상 1000자 이하로 적어 주세요.',
  tooOften: '짧은 시간에 너무 여러 번 보냈어요. 잠시 뒤에 다시 시도해 주세요.',
  blocked: '요청이 서버 검사에서 막혀 접수되지 않았어요. 페이지를 새로고침한 뒤 다시 보내 주세요.',
  paused: '지금은 건의 접수를 잠시 멈춰 둔 상태라 보내지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
  server: '서버로 전달하는 중 문제가 생겨 접수되지 않았어요. 잠시 뒤 다시 보내 주세요.',
  network:
    '네트워크에 연결하지 못해 보내지 못했어요. 연결 상태를 확인한 뒤 다시 보내 주세요. 작성한 내용은 그대로 남아 있어요.',
} as const;

function messageForStatus(status: number): string {
  if (status === 501) return MESSAGE.notConfigured;
  if (status === 413) return MESSAGE.tooLong;
  if (status === 429) return MESSAGE.tooOften;
  // 503 = 남용 방지 장치를 쓸 수 없어 라우트가 스스로 닫은 상태(fail-closed). 사용자 잘못이
  // 아니고 다시 보내면 되는 일이라, 서버 오류와 뭉뚱그리지 않고 그대로 말한다.
  if (status === 503) return MESSAGE.paused;
  // 우리 화면에서 보낸 요청은 여기 걸리지 않는다 — 확장 프로그램·오래된 탭 등 비정상 맥락 신호다.
  if (status === 403 || status === 415) return MESSAGE.blocked;
  // 408 = 본문이 제한 시간 안에 도착하지 않음 — 사용자 쪽 연결 문제다.
  if (status === 408) return MESSAGE.network;
  if (status === 400 || status === 422) return MESSAGE.invalid;
  return MESSAGE.server;
}

/**
 * 제출 맥락 — **클라이언트만 아는 값**만 모은다.
 *
 * `pageUrl` 은 `pathname` 뿐이다.
 *  - 호스트를 붙이지 않는 이유: 서버가 이미 안다.
 *  - **쿼리(`search`)·해시를 담지 않는 이유:** `?next=`·`?code=`·`?token=` 처럼 일회성 토큰이나
 *    개인 정보가 실리는 자리라, 그대로 저장하면 그 값이 건의 레코드로 복제된다. 화면을 아는 데
 *    필요한 것은 경로뿐이다. (스키마도 같은 규칙을 강제한다 — @pullim/shared 의 feedbackPagePath.)
 *  - 상한을 넘으면 **자른다**(거절하면 경로가 긴 화면에서 건의 자체를 잃는다).
 * 사용자 식별 정보는 어떤 경우에도 담지 않는다.
 */
function currentContext(): FeedbackClientContext | undefined {
  if (typeof window === 'undefined') return undefined;
  const candidate = {
    pageUrl: window.location.pathname.slice(0, FEEDBACK_PAGE_URL_MAX),
    // innerWidth 는 확대 상태에서 소수로 나온다 — 정수로 맞춘다(스키마가 정수만 받는다).
    viewport: { w: Math.round(window.innerWidth) || 0, h: Math.round(window.innerHeight) || 0 },
  };
  // 맥락이 스키마를 벗어나면 **맥락만 버린다.** 부가 정보 한 줄 때문에 제출이 400 으로
  // 막히는 것이 가장 나쁜 결말이다.
  const checked = feedbackClientContextSchema.safeParse(candidate);
  return checked.success ? checked.data : undefined;
}

/**
 * 건의 내용을 보낸다. 성공은 **서버가 저장까지 마쳤을 때만** ok:true 다.
 * 실패는 화면에 그대로 보여 줄 한국어 문장을 담아 돌려준다.
 */
export async function submitFeedback(input: FeedbackSubmission): Promise<FeedbackSendResult> {
  // 서버와 같은 스키마로 한 번 더 — 폼 상태 버그로 빈 값이 새어 나가도 왕복을 낭비하지 않는다.
  // 맥락은 **여기서** 붙인다 — 폼이 챙길 값이 아니고, 화면마다 빠뜨릴 여지도 없앤다.
  const parsed = feedbackSubmissionSchema.safeParse({
    ...input,
    context: input.context ?? currentContext(),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? MESSAGE.invalid };
  }

  let res: Response;
  try {
    res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(parsed.data),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, message: MESSAGE.network };
  }

  if (!res.ok) return { ok: false, message: messageForStatus(res.status) };
  return { ok: true };
}
