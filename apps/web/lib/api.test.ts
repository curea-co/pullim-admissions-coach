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
        return postHits === 1 ? json({ error: 'csrf' }, 403) : json({ ok: true });
      }
      return json({}, 404);
    });
    const api = createApiClient({ baseUrl: BASE, fetchImpl: fn });
    await api.post('/auth/logout');
    expect(csrfHits).toBe(2); // 최초 + 재부트스트랩
    expect(postHits).toBe(2); // 최초 403 + 재시도
  });
});
