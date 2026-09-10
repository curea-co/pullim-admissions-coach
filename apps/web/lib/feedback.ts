// 건의하기 — 노출 플래그 + 전송 클라이언트.
//
// 전송은 same-origin `/api/feedback` 한 곳으로만 간다. 수집처(FEEDBACK_WEBHOOK_URL)는 서버 전용이라
// 브라우저는 그 주소를 알지 못한다(app/api/feedback/route.ts 주석 참조).
//
// 오류 문구 원칙(§6): **원인 + 사용자가 할 수 있는 것**을 말한다. "실패했습니다" 같은 빈 문장이나,
// 전송되지 않았는데 완료 화면으로 넘기는 위장은 하지 않는다.

import { feedbackSubmissionSchema, type FeedbackSubmission } from '@pullim/shared';

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
  server: '서버로 전달하는 중 문제가 생겨 접수되지 않았어요. 잠시 뒤 다시 보내 주세요.',
  network:
    '네트워크에 연결하지 못해 보내지 못했어요. 연결 상태를 확인한 뒤 다시 보내 주세요. 작성한 내용은 그대로 남아 있어요.',
} as const;

function messageForStatus(status: number): string {
  if (status === 501) return MESSAGE.notConfigured;
  if (status === 413) return MESSAGE.tooLong;
  if (status === 429) return MESSAGE.tooOften;
  // 우리 화면에서 보낸 요청은 여기 걸리지 않는다 — 확장 프로그램·오래된 탭 등 비정상 맥락 신호다.
  if (status === 403 || status === 415) return MESSAGE.blocked;
  if (status === 400 || status === 422) return MESSAGE.invalid;
  return MESSAGE.server;
}

/**
 * 건의 내용을 보낸다. 성공은 **서버가 수집처 전달까지 마쳤을 때만** ok:true 다.
 * 실패는 화면에 그대로 보여 줄 한국어 문장을 담아 돌려준다.
 */
export async function submitFeedback(input: FeedbackSubmission): Promise<FeedbackSendResult> {
  // 서버와 같은 스키마로 한 번 더 — 폼 상태 버그로 빈 값이 새어 나가도 왕복을 낭비하지 않는다.
  const parsed = feedbackSubmissionSchema.safeParse(input);
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
