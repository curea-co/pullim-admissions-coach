import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { requestPinned, type PinnedRequestFn } from './pinned-request';

// 이 파일이 지키는 것은 하나다: **연결이 우리가 검증한 IP 로 간다.**
// 확인만 하고 이름으로 다시 연결하면(=fetch) 확인 시점과 연결 시점 사이에 DNS 응답이 바뀌는
// 리바인딩을 막지 못한다 — 자격증명을 싣는 요청에서는 그게 곧 secret 유출이다. 그래서 `lookup`
// 이 실제로 그 IP 를 돌려주는지 콜백까지 호출해 본다.
// 나머지는 "매달려 있지 않는다"의 경계다(본문 상한·절대 마감·쓰지 않을 본문 파기).

const target = new URL('https://api.example.test/me');

interface Capture {
  url?: unknown;
  options?: Record<string, unknown>;
  body?: string;
  resDestroyed?: boolean;
  reqDestroyed?: boolean;
}

interface FakeOptions {
  status?: number;
  /** 본문 청크. Buffer 로 흘린다(인코딩 지정이 없는 node 응답과 같게). */
  chunks?: string[];
  /** 본문을 끝내지 않는 상대(slow-drip) 흉내. */
  neverEnds?: boolean;
  fail?: Error;
}

function fakeRequest(capture: Capture, opts: FakeOptions = {}): PinnedRequestFn {
  const { status = 200, chunks = [''], neverEnds = false, fail } = opts;
  return ((url: unknown, options: Record<string, unknown>, cb: (res: unknown) => void) => {
    capture.url = url;
    capture.options = options;

    const req = new EventEmitter() as EventEmitter & {
      end: (body?: string) => void;
      destroy: (e?: Error) => void;
    };
    req.destroy = (e?: Error) => {
      capture.reqDestroyed = true;
      if (e) req.emit('error', e);
    };
    req.end = (body?: string) => {
      capture.body = body;
      if (fail) {
        setImmediate(() => req.emit('error', fail));
        return;
      }
      const res = (
        neverEnds ? new Readable({ read() {} }) : Readable.from(chunks.map((c) => Buffer.from(c)))
      ) as Readable & { statusCode: number };
      res.statusCode = status;
      const original = res.destroy.bind(res);
      res.destroy = ((error?: Error) => {
        capture.resDestroyed = true;
        original(error);
        return res;
      }) as typeof res.destroy;
      setImmediate(() => cb(res));
    };
    return req;
  }) as unknown as PinnedRequestFn;
}

/** options.lookup 을 실제로 불러 어떤 주소가 나오는지 본다 — 고정의 유일한 증거다. */
function pinnedAddress(options: Record<string, unknown> | undefined, all: boolean) {
  const lookup = options?.lookup as (h: string, o: object, c: (...a: unknown[]) => void) => void;
  let seen: unknown;
  lookup('api.example.test', { all }, (_err: unknown, value: unknown) => {
    seen = value;
  });
  return seen;
}

describe('requestPinned — 연결 고정', () => {
  it.each([
    ['단일 콜백 형태', false, '93.184.216.34'],
    ['all 콜백 형태', true, [{ address: '93.184.216.34', family: 4 }]],
  ])('lookup 이 검증한 IP 를 돌려준다(%s)', async (_label, all, expected) => {
    const capture: Capture = {};
    await requestPinned(target, '93.184.216.34', {
      method: 'GET',
      timeoutMs: 1_000,
      request: fakeRequest(capture),
    });
    expect(pinnedAddress(capture.options, all)).toEqual(expected);
  });

  it('요청 URL·메서드·헤더는 그대로 간다(TLS 는 호스트명 기준 그대로)', async () => {
    const capture: Capture = {};
    await requestPinned(target, '93.184.216.34', {
      method: 'GET',
      headers: { cookie: 'a=1' },
      timeoutMs: 1_000,
      request: fakeRequest(capture),
    });
    expect(capture.url).toBe(target); // 이름을 IP 로 바꿔치기하지 않는다
    expect(capture.options?.method).toBe('GET');
    expect((capture.options?.headers as Record<string, string>).cookie).toBe('a=1');
  });

  it('본문이 있으면 content-length 를 붙인다(바이트 기준)', async () => {
    const capture: Capture = {};
    await requestPinned(target, '93.184.216.34', {
      method: 'POST',
      body: '{"내용":"한글"}',
      timeoutMs: 1_000,
      request: fakeRequest(capture, { status: 201 }),
    });
    const headers = capture.options?.headers as Record<string, number>;
    expect(headers['content-length']).toBe(Buffer.byteLength('{"내용":"한글"}'));
    expect(capture.body).toBe('{"내용":"한글"}');
  });
});

describe('requestPinned — 응답 처리', () => {
  it('기본은 본문을 읽지 않고 파기한다(소켓을 붙잡아 두지 않게)', async () => {
    const capture: Capture = {};
    const res = await requestPinned(target, '93.184.216.34', {
      method: 'POST',
      body: '{}',
      timeoutMs: 1_000,
      request: fakeRequest(capture, { status: 201, chunks: ['{"id":"f_1"}'] }),
    });
    expect(res).toEqual({ status: 201, body: '' });
    expect(capture.resDestroyed).toBe(true);
  });

  it('readBody 면 본문을 이어 붙여 돌려준다', async () => {
    const capture: Capture = {};
    const res = await requestPinned(target, '93.184.216.34', {
      method: 'GET',
      timeoutMs: 1_000,
      readBody: true,
      request: fakeRequest(capture, { status: 200, chunks: ['{"sub"', ':"u_abc"}'] }),
    });
    expect(res).toEqual({ status: 200, body: '{"sub":"u_abc"}' });
  });

  it('본문이 상한을 넘으면 끊고 실패로 본다(응답이 메모리를 먹지 않게)', async () => {
    const capture: Capture = {};
    await expect(
      requestPinned(target, '93.184.216.34', {
        method: 'GET',
        timeoutMs: 1_000,
        readBody: true,
        maxBodyBytes: 8,
        request: fakeRequest(capture, { chunks: ['x'.repeat(64)] }),
      }),
    ).rejects.toThrow(/too large/);
    expect(capture.resDestroyed).toBe(true);
  });

  it('상태 코드는 그대로 돌려준다 — 3xx 도 성공으로 치지 않는다(리다이렉트 미추적)', async () => {
    const capture: Capture = {};
    const res = await requestPinned(target, '93.184.216.34', {
      method: 'GET',
      timeoutMs: 1_000,
      request: fakeRequest(capture, { status: 302 }),
    });
    expect(res.status).toBe(302);
  });

  it('연결 실패는 reject 로 올라간다', async () => {
    const capture: Capture = {};
    await expect(
      requestPinned(target, '93.184.216.34', {
        method: 'GET',
        timeoutMs: 1_000,
        request: fakeRequest(capture, { fail: new Error('ECONNREFUSED') }),
      }),
    ).rejects.toThrow('ECONNREFUSED');
  });

  it('본문을 끝내지 않는 상대는 **절대 마감**에 끊는다(소켓 무활동 타임아웃만으로는 안 끝난다)', async () => {
    vi.useFakeTimers();
    try {
      const capture: Capture = {};
      const pending = requestPinned(target, '93.184.216.34', {
        method: 'GET',
        timeoutMs: 50,
        readBody: true,
        request: fakeRequest(capture, { neverEnds: true }),
      });
      const assertion = expect(pending).rejects.toThrow(/timeout/);
      await vi.advanceTimersByTimeAsync(100);
      await assertion;
      expect(capture.reqDestroyed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
