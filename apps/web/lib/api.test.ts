import { describe, it, expect, vi } from 'vitest';
import { createApiClient, type ApiError } from './api';

// 프로그래머블 fetch 목: (url, init) → Response. 호출 기록도 보관.
function mockFetch(handler: (url: string, init: RequestInit) => Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const i = init ?? {};
    calls.push({ url, init: i });
    return handler(url, i);
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const BASE = 'http://api.test';

describe('createApiClient', () => {
  it('변경 요청에 CSRF 토큰을 echo한다(부트스트랩 후)', async () => {
    const { fn, calls } = mockFetch((url, init) => {
      if (url.endsWith('/auth/csrf')) return json({ csrfToken: 'TOK123' });
      if (url.endsWith('/auth/login') && init.method === 'POST') return json({ ok: true });
      return json({}, 404);
    });
    const api = createApiClient({ baseUrl: BASE, fetchImpl: fn });
    await api.post('/auth/login', { email: 'a', password: 'b' });

    const csrf = calls.find((c) => c.url.endsWith('/auth/csrf'));
    const login = calls.find((c) => c.url.endsWith('/auth/login'));
    expect(csrf).toBeTruthy();
    expect((login!.init.headers as Record<string, string>)['X-CSRF-Token']).toBe('TOK123');
    expect(login!.init.credentials).toBe('include');
  });

  it('401 → refresh 후 원요청 1회 재시도', async () => {
    let getCount = 0;
    const { fn, calls } = mockFetch((url, init) => {
      if (url.endsWith('/auth/csrf')) return json({ csrfToken: 'fresh-token' });
      if (url.endsWith('/auth/refresh') && init.method === 'POST') return json({ ok: true });
      if (url.endsWith('/me')) {
        getCount++;
        return getCount === 1 ? json({ error: 'expired' }, 401) : json({ sub: 'u1' });
      }
      return json({}, 404);
    });
    const api = createApiClient({ baseUrl: BASE, fetchImpl: fn });
    const me = await api.get<{ sub: string }>('/me');
    expect(me.sub).toBe('u1');
    expect(calls.filter((c) => c.url.endsWith('/auth/refresh'))).toHaveLength(1);
    expect(getCount).toBe(2); // 최초 + 재시도
  });

  it('동시 만료 요청은 refresh를 1회만 호출(single-flight)', async () => {
    const meState: Record<string, number> = {};
    const { fn, calls } = mockFetch((url, init) => {
      if (url.endsWith('/auth/csrf')) return json({ csrfToken: 'fresh-token' });
      if (url.endsWith('/auth/refresh') && init.method === 'POST') return json({ ok: true });
      if (url.endsWith('/a') || url.endsWith('/b')) {
        const key = url.endsWith('/a') ? 'a' : 'b';
        meState[key] = (meState[key] ?? 0) + 1;
        return meState[key] === 1 ? json({}, 401) : json({ ok: key });
      }
      return json({}, 404);
    });
    const api = createApiClient({ baseUrl: BASE, fetchImpl: fn });
    await Promise.all([api.get('/a'), api.get('/b')]);
    expect(calls.filter((c) => c.url.endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it('refresh가 401이면 재귀 없이 authExpired 에러', async () => {
    const { fn, calls } = mockFetch((url, init) => {
      if (url.endsWith('/auth/csrf')) return json({ csrfToken: 'fresh-token' });
      if (url.endsWith('/auth/refresh') && init.method === 'POST') return json({ error: 'no' }, 401);
      if (url.endsWith('/me')) return json({ error: 'expired' }, 401);
      return json({}, 404);
    });
    const api = createApiClient({ baseUrl: BASE, fetchImpl: fn });
    await expect(api.get('/me')).rejects.toMatchObject({ status: 401, authExpired: true });
    // refresh는 단 1회(재귀 금지)
    expect(calls.filter((c) => c.url.endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it('에러 본문을 ApiError(status·fieldErrors)로 정규화', async () => {
    const { fn } = mockFetch((url) => {
      if (url.endsWith('/auth/csrf')) return json({ csrfToken: 't' });
      return json({ message: '이미 가입된 이메일', fieldErrors: { email: '중복' } }, 400);
    });
    const api = createApiClient({ baseUrl: BASE, fetchImpl: fn });
    const err = (await api.post('/auth/signup', {}).catch((e) => e)) as ApiError;
    expect(err.status).toBe(400);
    expect(err.message).toBe('이미 가입된 이메일');
    expect(err.fieldErrors?.email).toBe('중복');
  });

  it('베이스 URL 미설정이면 호출 시 즉시 throw(fail-closed)', async () => {
    const { fn, calls } = mockFetch(() => json({}));
    const api = createApiClient({ baseUrl: '', fetchImpl: fn });
    await expect(api.get('/me')).rejects.toThrow(/베이스 URL/);
    expect(calls).toHaveLength(0); // 네트워크 호출 자체가 없어야
  });

  it('403(CSRF) → 재부트스트랩 후 1회 재시도', async () => {
    let csrfHits = 0;
    let postHits = 0;
    const { fn } = mockFetch((url, init) => {
      if (url.endsWith('/auth/csrf')) {
        csrfHits++;
        return json({ csrfToken: `tok${csrfHits}` });
      }
      if (url.endsWith('/auth/logout') && init.method === 'POST') {
        postHits++;
        return postHits === 1 ? json({ code: 'CSRF_TOKEN_MISMATCH' }, 403) : json({ ok: true });
      }
      return json({}, 404);
    });
    const api = createApiClient({ baseUrl: BASE, fetchImpl: fn });
    await api.post('/auth/logout');
    expect(csrfHits).toBe(2); // 최초 + 재부트스트랩
    expect(postHits).toBe(2); // 최초 403 + 재시도
  });
});


describe('CSRF recovery contract', () => {
  it('GET 401 뒤 refresh도 먼저 CSRF를 확보한다', async () => {
    let reads = 0;
    const { fn, calls } = mockFetch((url) => {
      if (url.endsWith('/auth/csrf')) return json({ csrfToken: 'fresh' });
      if (url.endsWith('/auth/refresh')) return json({ ok: true });
      return ++reads === 1 ? json({}, 401) : json({ ok: true });
    });
    await createApiClient({ baseUrl: BASE, fetchImpl: fn }).get('/me');
    const refresh = calls.find((call) => call.url.endsWith('/auth/refresh'))!;
    expect(refresh.init.headers).toMatchObject({ 'X-CSRF-Token': 'fresh' });
    expect(refresh.init.credentials).toBe('include');
    expect(calls.map((call) => call.url)).toEqual([
      `${BASE}/me`, `${BASE}/auth/csrf`, `${BASE}/auth/refresh`, `${BASE}/me`,
    ]);
  });

  it.each(['FORBIDDEN', 'CSRF_ORIGIN_REJECTED', undefined])(
    '일반 또는 Origin 403(%s)은 재시도하지 않는다', async (code) => {
      const { fn, calls } = mockFetch((url) => url.endsWith('/auth/csrf')
        ? json({ csrfToken: 'token' }) : json({ code, message: '거부' }, 403));
      await expect(createApiClient({ baseUrl: BASE, fetchImpl: fn }).post('/write'))
        .rejects.toMatchObject({ status: 403, message: '거부', code });
      expect(calls.filter((call) => call.url.endsWith('/write'))).toHaveLength(1);
      expect(calls.filter((call) => call.url.endsWith('/auth/csrf'))).toHaveLength(1);
    },
  );

  it('refresh 자체의 CSRF mismatch도 한 번 복구한다', async () => {
    let reads = 0;
    let refreshes = 0;
    let bootstraps = 0;
    const { fn, calls } = mockFetch((url) => {
      if (url.endsWith('/auth/csrf')) return json({ csrfToken: `token-${++bootstraps}` });
      if (url.endsWith('/auth/refresh')) return ++refreshes === 1
        ? json({ code: 'CSRF_TOKEN_MISMATCH' }, 403) : json({ ok: true });
      return ++reads === 1 ? json({}, 401) : json({ ok: true });
    });
    await expect(createApiClient({ baseUrl: BASE, fetchImpl: fn }).get('/me'))
      .resolves.toEqual({ ok: true });
    expect(refreshes).toBe(2);
    expect(calls.filter((call) => call.url.endsWith('/auth/refresh')).map((call) => call.init.headers))
      .toEqual([{ 'X-CSRF-Token': 'token-1' }, { 'X-CSRF-Token': 'token-2' }]);
  });

  it('401 → refresh 성공 → 원요청 mismatch도 한 번 복구한다(Q #315)', async () => {
    let writes = 0;
    let bootstraps = 0;
    const { fn, calls } = mockFetch((url) => {
      if (url.endsWith('/auth/csrf')) return json({ csrfToken: `token-${++bootstraps}` });
      if (url.endsWith('/auth/refresh')) return json({ ok: true });
      writes++;
      if (writes === 1) return json({}, 401);
      if (writes === 2) return json({ code: 'CSRF_TOKEN_MISMATCH' }, 403);
      return json({ ok: true });
    });
    await expect(createApiClient({ baseUrl: BASE, fetchImpl: fn }).post('/write', { value: 1 }))
      .resolves.toEqual({ ok: true });
    const attempts = calls.filter((call) => call.url.endsWith('/write'));
    expect(attempts).toHaveLength(3);
    expect(attempts.map((call) => call.init.headers)).toEqual([
      { 'Content-Type': 'application/json', 'X-CSRF-Token': 'token-1' },
      { 'Content-Type': 'application/json', 'X-CSRF-Token': 'token-2' },
      { 'Content-Type': 'application/json', 'X-CSRF-Token': 'token-3' },
    ]);
    expect(attempts.every((call) => call.init.body === '{"value":1}')).toBe(true);
  });

  it('원요청 CSRF 재시도 예산은 refresh 전후 합쳐 한 번이다', async () => {
    let writes = 0;
    const { fn, calls } = mockFetch((url) => {
      if (url.endsWith('/auth/csrf')) return json({ csrfToken: 'token' });
      if (url.endsWith('/auth/refresh')) return json({ ok: true });
      return ++writes === 2 ? json({}, 401) : json({ code: 'CSRF_TOKEN_MISMATCH' }, 403);
    });
    await expect(createApiClient({ baseUrl: BASE, fetchImpl: fn }).post('/write'))
      .rejects.toMatchObject({ status: 403, code: 'CSRF_TOKEN_MISMATCH' });
    expect(writes).toBe(3);
    expect(calls.filter((call) => call.url.endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it.each(['CSRF_ORIGIN_REJECTED', 'FORBIDDEN', 'CSRF_TOKEN_MISMATCH'])(
    'refresh 403(%s)을 세션 만료 401로 바꾸지 않는다', async (code) => {
      const { fn, calls } = mockFetch((url) => {
        if (url.endsWith('/auth/csrf')) return json({ csrfToken: 'token' });
        if (url.endsWith('/auth/refresh')) return json({ code, message: '거부' }, 403);
        return json({}, 401);
      });
      const error = await createApiClient({ baseUrl: BASE, fetchImpl: fn }).get('/me').catch((e: ApiError) => e);
      expect(error).toMatchObject({ status: 403, code, message: '거부' });
      expect(error).not.toHaveProperty('authExpired', true);
      expect(calls.filter((call) => call.url.endsWith('/auth/refresh')))
        .toHaveLength(code === 'CSRF_TOKEN_MISMATCH' ? 2 : 1);
    },
  );

  it('동시 write의 CSRF 부트스트랩을 공유한다', async () => {
    const { fn, calls } = mockFetch((url) => url.endsWith('/auth/csrf')
      ? json({ csrfToken: 'token' }) : json({ ok: true }));
    const api = createApiClient({ baseUrl: BASE, fetchImpl: fn });
    await Promise.all([api.post('/a'), api.post('/b')]);
    expect(calls.filter((call) => call.url.endsWith('/auth/csrf'))).toHaveLength(1);
    expect(calls.find((call) => call.url.endsWith('/auth/csrf'))!.init.cache).toBe('no-store');
  });

  it.each([{}, { csrfToken: '' }, { csrfToken: 123 }, null])(
    '잘못된 CSRF 응답(%j)이면 write를 보내지 않는다', async (body) => {
      const { fn, calls } = mockFetch(() => json(body));
      await expect(createApiClient({ baseUrl: BASE, fetchImpl: fn }).post('/write')).rejects.toThrow();
      expect(calls).toHaveLength(1);
    },
  );

  it('직접 refresh 호출도 mismatch만 한 번 복구하고 재귀하지 않는다', async () => {
    let refreshes = 0;
    const { fn, calls } = mockFetch((url) => {
      if (url.endsWith('/auth/csrf')) return json({ csrfToken: 'token' });
      return ++refreshes === 1 ? json({ code: 'CSRF_TOKEN_MISMATCH' }, 403) : json({}, 401);
    });
    await expect(createApiClient({ baseUrl: BASE, fetchImpl: fn }).post('/auth/refresh'))
      .rejects.toMatchObject({ status: 401 });
    expect(calls.filter((call) => call.url.endsWith('/auth/refresh'))).toHaveLength(2);
  });
  it('GET 403은 CSRF bootstrap이나 재시도 없이 전달한다', async () => {
    const { fn, calls } = mockFetch(() => json({ code: 'CSRF_TOKEN_MISMATCH' }, 403));
    await expect(createApiClient({ baseUrl: BASE, fetchImpl: fn }).get('/me'))
      .rejects.toMatchObject({ status: 403, code: 'CSRF_TOKEN_MISMATCH' });
    expect(calls).toHaveLength(1);
  });

  it('동시 refresh 실패의 오류 본문을 모든 호출자가 읽는다', async () => {
    const { fn, calls } = mockFetch((url) => {
      if (url.endsWith('/auth/csrf')) return json({ csrfToken: 'token' });
      if (url.endsWith('/auth/refresh')) return json({ code: 'CSRF_ORIGIN_REJECTED', message: 'Origin 거부' }, 403);
      return json({}, 401);
    });
    const api = createApiClient({ baseUrl: BASE, fetchImpl: fn });
    const results = await Promise.allSettled([api.get('/a'), api.get('/b')]);
    for (const result of results) {
      expect(result).toMatchObject({ status: 'rejected', reason: {
        status: 403, code: 'CSRF_ORIGIN_REJECTED', message: 'Origin 거부',
      } });
    }
    expect(calls.filter((call) => call.url.endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it('bootstrap 실패 뒤 다음 요청은 다시 확보한다', async () => {
    let bootstraps = 0;
    const { fn, calls } = mockFetch((url) => {
      if (url.endsWith('/auth/csrf')) return ++bootstraps === 1
        ? json({}, 503) : json({ csrfToken: 'token' });
      return json({ ok: true });
    });
    const api = createApiClient({ baseUrl: BASE, fetchImpl: fn });
    await expect(api.post('/write')).rejects.toMatchObject({ status: 503 });
    await expect(api.post('/write')).resolves.toEqual({ ok: true });
    expect(calls.filter((call) => call.url.endsWith('/write'))).toHaveLength(1);
  });

  it('refresh 서버 오류를 만료로 오인하지 않고 다음 호출에서 다시 시도한다', async () => {
    let refreshes = 0;
    const { fn } = mockFetch((url) => {
      if (url.endsWith('/auth/csrf')) return json({ csrfToken: 'token' });
      if (url.endsWith('/auth/refresh')) {
        refreshes++;
        return json({ code: 'UNAVAILABLE', message: '서버 오류' }, 503);
      }
      return json({}, 401);
    });
    const api = createApiClient({ baseUrl: BASE, fetchImpl: fn });
    for (let i = 0; i < 2; i++) {
      await expect(api.get('/me')).rejects.toMatchObject({ status: 503, code: 'UNAVAILABLE' });
    }
    expect(refreshes).toBe(2);
  });

});
