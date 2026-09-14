import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import type { ClientRequest, IncomingMessage, RequestOptions } from 'node:http';

// 서버가 바깥으로 보내는 요청 하나 — **검증한 IP 에 연결을 고정한다.**
//
// 왜 fetch 가 아닌가: 주소를 확인한 뒤 fetch 를 부르면 fetch 가 호스트명을 **다시 해석한다.**
// 그 사이에 응답이 바뀌면(DNS 리바인딩) 확인은 공인 주소로 통과했는데 실제 연결은 내부망으로
// 간다. 자격증명(서비스 키·인증 쿠키)을 싣는 요청에서는 그게 곧 secret 유출이다. 확인과 연결이
// 같은 주소를 보게 하려면 연결 대상 IP 를 우리가 정해야 하고, 그 손잡이가 node http(s) 의
// `lookup` 옵션이다.
//
// TLS 는 그대로다 — servername(SNI)·인증서 검증은 URL 의 호스트명 기준으로 이뤄지고, 바뀌는
// 것은 "그 이름을 어느 IP 로 연결하는가" 뿐이다. 즉 IP 를 고정해도 남의 인증서를 받아들이지 않는다.
// 리다이렉트도 따라가지 않는다(node 기본) — 3xx 는 상태 코드로 돌아오고 호출부가 실패로 본다.
//
// (원래 lib/webhook-post.ts 안에 있던 구현을 메서드·본문 읽기까지 다룰 수 있게 일반화한 것이다.
//  `postJsonPinned` 는 이 함수를 부르는 얇은 래퍼로 남는다.)

export type PinnedRequestFn = typeof httpsRequest;

export interface PinnedRequestInit {
  method: 'GET' | 'POST';
  headers?: Record<string, string | number>;
  /** POST 본문. 문자열만 받는다(JSON 은 호출부가 직렬화한다). */
  body?: string;
  /** 응답이 없을 때 매달려 있지 않도록 하는 **절대** 마감. 본문 읽기까지 포함한다. */
  timeoutMs: number;
  /**
   * 응답 본문을 읽을지. 기본은 **읽지 않는다** — 상태 코드만 쓸 것이면 헤더를 받는 즉시 응답을
   * 파기한다. 본문을 기다리면 헤더만 보내고 본문을 흘리지 않는 상대가 소켓을 붙잡아 둔다.
   */
  readBody?: boolean;
  /** 본문 상한. 넘으면 끊고 실패로 본다(응답이 서버 메모리를 먹지 않게). */
  maxBodyBytes?: number;
  /** 테스트 주입용. 기본은 프로토콜에 맞는 node http(s) 의 request. */
  request?: PinnedRequestFn;
}

export interface PinnedResponse {
  status: number;
  /** `readBody` 가 아닐 때는 빈 문자열. */
  body: string;
}

const DEFAULT_MAX_BODY_BYTES = 64 * 1024;

/**
 * `target` 으로 요청을 보내되, 연결은 `address`(미리 검증한 IP)로 고정한다.
 * 반환: 상태 코드(+ 요청했다면 본문). 연결 실패·타임아웃·본문 초과는 reject.
 */
export function requestPinned(
  target: URL,
  address: string,
  init: PinnedRequestInit,
): Promise<PinnedResponse> {
  const {
    method,
    headers = {},
    body,
    timeoutMs,
    readBody = false,
    maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
  } = init;
  const request = init.request ?? (target.protocol === 'http:' ? httpRequest : httpsRequest);
  const family = address.includes(':') ? 6 : 4;

  const options: RequestOptions = {
    method,
    headers: {
      ...headers,
      ...(body === undefined ? {} : { 'content-length': Buffer.byteLength(body) }),
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

  return new Promise<PinnedResponse>((resolve, reject) => {
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
        const status = res.statusCode ?? 0;
        if (!readBody) {
          // 쓰지 않을 본문은 기다리지 않는다 — 헤더를 받는 즉시 판정하고 응답을 파기한다.
          res.destroy();
          finish(() => resolve({ status, body: '' }));
          return;
        }

        const chunks: Buffer[] = [];
        let total = 0;
        res.on('data', (chunk: Buffer | string) => {
          // 인코딩을 지정하지 않았으므로 node 는 Buffer 를 준다. 문자열을 주는 구현도 받아 둔다.
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
          total += buf.byteLength;
          if (total > maxBodyBytes) {
            res.destroy();
            finish(() => reject(new Error('response body too large')));
            return;
          }
          chunks.push(buf);
        });
        res.on('end', () => finish(() => resolve({ status, body: Buffer.concat(chunks).toString('utf8') })));
        res.on('error', (error) => finish(() => reject(error)));
      });
    } catch (error) {
      reject(error);
      return;
    }

    // 소켓 무활동 타임아웃은 데이터가 올 때마다 갱신된다 — 전체에 걸리는 **절대 마감**을 따로 둔다.
    deadline = setTimeout(() => {
      finish(() => {
        req.destroy();
        reject(new Error('pinned request timeout'));
      });
    }, timeoutMs);

    req.on('timeout', () => req.destroy(new Error('pinned request timeout')));
    req.on('error', (error) => finish(() => reject(error)));
    req.end(body);
  });
}
