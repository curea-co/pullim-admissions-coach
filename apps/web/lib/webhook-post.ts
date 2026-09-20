import type { request as httpsRequest } from 'node:https';
import { requestPinned } from './pinned-request';

// 수집처로 보내는 한 번의 POST — **검증한 IP 에 연결을 고정한다.**
//
// 고정의 실제 구현은 lib/pinned-request.ts 로 옮겼다(저장 표면도 같은 보장이 필요해져 일반화).
// 이 파일은 "JSON 을 POST 하고 상태 코드만 본다"는 웹훅 쪽 계약을 그대로 유지하는 얇은 래퍼다.

export type HttpsRequestFn = typeof httpsRequest;

export interface PinnedPostOptions {
  /** 응답이 없을 때 매달려 있지 않도록 하는 상한. */
  timeoutMs: number;
  /** 테스트 주입용. 기본 node:https 의 request. */
  request?: HttpsRequestFn;
}

/**
 * `target` 으로 JSON 본문을 POST 하되, 연결은 `address`(미리 검증한 IP)로 고정한다.
 * 반환: 응답 상태 코드. 연결 실패·타임아웃은 reject.
 */
export async function postJsonPinned(
  target: URL,
  address: string,
  payload: unknown,
  { timeoutMs, request }: PinnedPostOptions,
): Promise<number> {
  const { status } = await requestPinned(target, address, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    timeoutMs,
    request,
  });
  return status;
}
