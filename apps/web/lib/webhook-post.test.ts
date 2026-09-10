import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { postJsonPinned, type HttpsRequestFn } from './webhook-post';

// 이 파일이 지키는 것은 하나다: **연결이 우리가 검증한 IP 로 간다.**
// 확인만 하고 이름으로 다시 연결하면(=fetch) 확인 시점과 연결 시점 사이에 DNS 응답이 바뀌는
// 리바인딩을 막지 못한다. 그래서 `lookup` 이 실제로 그 IP 를 돌려주는지 콜백까지 호출해 본다.

interface Capture {
  url?: unknown;
  options?: Record<string, unknown>;
  body?: string;
  status: number;
  fail?: Error;
  timeout?: boolean;
}

/** node:https 의 request 를 대신한다 — 실제 소켓을 열지 않고 옵션과 본문만 잡는다. */
function fakeRequest(capture: Capture): HttpsRequestFn {
  return ((url: unknown, options: Record<string, unknown>, cb: (res: unknown) => void) => {
    capture.url = url;
    capture.options = options;
    const req = new EventEmitter() as EventEmitter & {
      end: (body: string) => void;
      destroy: (e?: Error) => void;
    };
    req.destroy = (e?: Error) => {
      req.emit('error', e ?? new Error('destroyed'));
    };
    req.end = (body: string) => {
      capture.body = body;
      if (capture.timeout) {
        setImmediate(() => req.emit('timeout'));
        return;
      }
      if (capture.fail) {
        setImmediate(() => req.emit('error', capture.fail));
        return;
      }
      const res = Readable.from(['']) as Readable & { statusCode: number };
      res.statusCode = capture.status;
      setImmediate(() => cb(res));
    };
    return req;
  }) as unknown as HttpsRequestFn;
}

const target = new URL('https://hooks.slack.com/services/T0/B0/xxx');

describe('postJsonPinned — 연결 대상 고정', () => {
  it('lookup 이 검증한 IP 를 돌려준다(호스트명을 다시 해석하지 않는다)', async () => {
    const capture: Capture = { status: 200 };
    await postJsonPinned(target, '3.5.7.9', { text: '내용' }, {
      timeoutMs: 1000,
      request: fakeRequest(capture),
    });

    const lookup = capture.options?.lookup as (
      host: string,
      opts: { all?: boolean },
      cb: (...args: unknown[]) => void,
    ) => void;
    expect(typeof lookup).toBe('function');

    // all:false 형태(주소·family)
    const single: unknown[] = [];
    lookup('hooks.slack.com', {}, (...args) => single.push(...args));
    expect(single).toEqual([null, '3.5.7.9', 4]);

    // all:true 형태(목록) — Node 의 autoSelectFamily 경로
    const many: unknown[] = [];
    lookup('hooks.slack.com', { all: true }, (...args) => many.push(...args));
    expect(many).toEqual([null, [{ address: '3.5.7.9', family: 4 }]]);
  });

  it('IPv6 주소면 family 6 으로 고정한다', async () => {
    const capture: Capture = { status: 200 };
    await postJsonPinned(target, '2606:4700::1111', {}, {
      timeoutMs: 1000,
      request: fakeRequest(capture),
    });
    const lookup = capture.options?.lookup as (
      host: string,
      opts: { all?: boolean },
      cb: (...args: unknown[]) => void,
    ) => void;
    const out: unknown[] = [];
    lookup('x', {}, (...args) => out.push(...args));
    expect(out).toEqual([null, '2606:4700::1111', 6]);
  });

  it('URL·본문·헤더를 그대로 보낸다', async () => {
    const capture: Capture = { status: 200 };
    await postJsonPinned(target, '3.5.7.9', { text: '건의 내용' }, {
      timeoutMs: 1000,
      request: fakeRequest(capture),
    });
    expect(capture.url).toBe(target);
    expect(capture.options?.method).toBe('POST');
    expect(JSON.parse(capture.body ?? '{}')).toEqual({ text: '건의 내용' });
    const headers = capture.options?.headers as Record<string, unknown>;
    expect(headers['content-type']).toBe('application/json');
    expect(headers['content-length']).toBe(Buffer.byteLength(capture.body ?? ''));
    expect(capture.options?.timeout).toBe(1000);
  });
});

describe('postJsonPinned — 응답 처리', () => {
  it('상태 코드를 그대로 돌려준다', async () => {
    for (const status of [200, 204, 302, 404, 500]) {
      const capture: Capture = { status };
      const result = await postJsonPinned(target, '3.5.7.9', {}, {
        timeoutMs: 1000,
        request: fakeRequest(capture),
      });
      // 3xx 도 상태로 돌아온다 — 리다이렉트를 따라가지 않으므로 호출부가 실패로 판정한다.
      expect(result).toBe(status);
    }
  });

  it('연결 실패는 reject', async () => {
    const capture: Capture = { status: 200, fail: new Error('ECONNREFUSED') };
    await expect(
      postJsonPinned(target, '3.5.7.9', {}, { timeoutMs: 1000, request: fakeRequest(capture) }),
    ).rejects.toThrow('ECONNREFUSED');
  });

  it('타임아웃은 연결을 끊고 reject(요청이 매달려 있지 않게)', async () => {
    const capture: Capture = { status: 200, timeout: true };
    await expect(
      postJsonPinned(target, '3.5.7.9', {}, { timeoutMs: 5, request: fakeRequest(capture) }),
    ).rejects.toThrow('webhook timeout');
  });
});
