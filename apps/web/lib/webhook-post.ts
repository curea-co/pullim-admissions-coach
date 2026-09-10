import { request as httpsRequest, type RequestOptions } from 'node:https';
import type { ClientRequest, IncomingMessage } from 'node:http';

// 수집처로 보내는 한 번의 POST — **검증한 IP 에 연결을 고정한다.**
//
// 왜 fetch 가 아닌가: 주소를 확인한 뒤 fetch 를 부르면 fetch 가 호스트명을 **다시 해석한다.**
// 그 사이에 응답이 바뀌면(DNS 리바인딩) 확인은 공인 주소로 통과했는데 실제 연결은 내부망으로
// 간다. 확인과 연결이 같은 주소를 보게 하려면 연결 대상 IP 를 우리가 정해야 하고, 그 손잡이가
// node:https 의 `lookup` 옵션이다.
//
// TLS 는 그대로다 — servername(SNI)·인증서 검증은 URL 의 호스트명 기준으로 이뤄지고, 바뀌는
// 것은 "그 이름을 어느 IP 로 연결하는가" 뿐이다. 즉 IP 를 고정해도 남의 인증서를 받아들이지 않는다.
// 리다이렉트도 따라가지 않는다(node:https 기본) — 3xx 는 상태 코드로 돌아오고 호출부가 실패로 본다.

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
export function postJsonPinned(
  target: URL,
  address: string,
  payload: unknown,
  { timeoutMs, request = httpsRequest }: PinnedPostOptions,
): Promise<number> {
  const body = JSON.stringify(payload);
  const family = address.includes(':') ? 6 : 4;

  const options: RequestOptions = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body),
    },
    timeout: timeoutMs,
    // 연결 대상 고정. net.connect 는 Node 버전·autoSelectFamily 에 따라 `all` 을 켜서 부르므로
    // 두 콜백 형태를 모두 만족시킨다.
    lookup: ((hostname: string, opts: { all?: boolean }, callback: unknown) => {
      const cb = callback as (
        err: NodeJS.ErrnoException | null,
        addressOrList: string | Array<{ address: string; family: number }>,
        family?: number,
      ) => void;
      if (opts?.all) cb(null, [{ address, family }]);
      else cb(null, address, family);
    }) as RequestOptions['lookup'],
  };

  return new Promise<number>((resolve, reject) => {
    let settled = false;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      fn();
    };

    let req: ClientRequest;
    try {
      req = request(target, options, (res: IncomingMessage) => {
        // 우리가 쓰는 것은 상태 코드뿐이다. 본문을 기다리면, 2xx 헤더만 보내고 본문을 천천히
        // 흘리거나 끝내지 않는 수집처가 이 요청과 소켓을 붙잡아 둘 수 있다(공개 라우트라 그게
        // 곧 자원 고갈이다). 헤더를 받는 즉시 판정하고 응답을 파기한다.
        const status = res.statusCode ?? 0;
        res.destroy();
        finish(() => resolve(status));
      });
    } catch (error) {
      reject(error);
      return;
    }

    // 소켓 무활동 타임아웃은 데이터가 올 때마다 갱신된다 — 전체에 걸리는 **절대 마감**을 따로 둔다.
    deadline = setTimeout(() => {
      finish(() => {
        req.destroy();
        reject(new Error('webhook timeout'));
      });
    }, timeoutMs);

    req.on('timeout', () => req.destroy(new Error('webhook timeout')));
    req.on('error', (error) => finish(() => reject(error)));
    req.end(body);
  });
}
