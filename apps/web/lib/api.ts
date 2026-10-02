'use client';

import { AuthContextChangedError, AuthSessionExpiredError, createAuthCore } from './auth-core';

/**
 * pullim-api HTTP 클라이언트 (B: 실 인증 연동).
 *
 * 설계: docs/superpowers/specs/2026-06-24-auth-mypage-design.md §4·§6·§8.
 * - 모든 요청 `credentials: 'include'`(httpOnly 쿠키 세션).
 * - CSRF: `GET /auth/csrf`로 토큰 부트스트랩 → 변경 요청에 `X-CSRF-Token` echo.
 * - 401: `POST /auth/refresh` **single-flight**(동시 만료 시 1회만) 후 원요청 1회 재시도.
 *   refresh 자체는 다시 refresh를 호출하지 않는다.
 * - 변경 요청의 CSRF_TOKEN_MISMATCH만 재부트스트랩 후 1회 복구(refresh POST 포함).
 * - 에러는 `ApiError`로 정규화(status + 필드 에러).
 *
 * 이 파일은 DTO에 독립적인 전송 계층이다. 엔드포인트별 요청/응답 매핑은
 * `lib/auth/pullim-api-adapter.ts`에서 한다.
 */

export interface ApiError extends Error {
  status: number;
  /** 서버가 준 필드 단위 검증 에러(있으면). */
  fieldErrors?: Record<string, string>;
  /** 인증 만료(401 + refresh 실패) 구분 플래그 — 호출자가 /login 유도. */
  authExpired?: boolean;
  /**
   * 서버가 준 기계 판독 오류 코드(있으면). 호출자는 **메시지 문구가 아니라 이 값으로 분기**한다 —
   * 문구는 레포가 다르고 계약 테스트가 없어 문안을 다듬는 순간 분기가 조용히 깨진다.
   */
  code?: string;
}

function makeApiError(
  message: string,
  status: number,
  extra: Partial<ApiError> = {}
): ApiError {
  const e = new Error(message) as ApiError;
  e.status = status;
  Object.assign(e, extra);
  return e;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';
const MUTATING: Method[] = ['POST', 'PATCH', 'DELETE'];

export interface ApiClient {
  subscribeExpired(listener: () => void): () => void;
  generation(): number;
  request<T = unknown>(method: Method, path: string, body?: unknown): Promise<T>;
  get<T = unknown>(path: string): Promise<T>;
  post<T = unknown>(path: string, body?: unknown): Promise<T>;
  patch<T = unknown>(path: string, body?: unknown): Promise<T>;
  del<T = unknown>(path: string): Promise<T>;
}

export interface ApiClientOptions {
  baseUrl: string;
  /** 테스트 주입용. 기본 전역 fetch. */
  fetchImpl?: typeof fetch;
  /** CSRF 부트스트랩 엔드포인트. 기본 `/auth/csrf`. */
  csrfPath?: string;
  /** refresh 엔드포인트. 기본 `/auth/refresh`. */
  refreshPath?: string;
}

export function createApiClient(opts: ApiClientOptions): ApiClient {
  const { baseUrl } = opts;
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const csrfPath = opts.csrfPath ?? '/auth/csrf';
  const refreshPath = opts.refreshPath ?? '/auth/refresh';

  // 인스턴스 로컬 상태(모듈 전역 아님 — 테스트 격리/멀티 인스턴스 안전).
  let generation = 0;
  const expiryListeners = new Set<() => void>();
  let csrfToken: string | null = null;
  let csrfInFlight: Promise<void> | null = null;


  const url = (path: string) => `${baseUrl}${path}`;

  /** 동시 요청의 bootstrap을 공유하며 실패 뒤에는 다시 시도할 수 있게 한다. */
  function bootstrapCsrf(): Promise<void> {
    if (csrfInFlight) return csrfInFlight;
    csrfInFlight = (async () => {
      const res = await fetchImpl(url(csrfPath), {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) throw makeApiError('CSRF 부트스트랩 실패', res.status);
      const data: unknown = await res.json().catch(() => null);
      if (
        !data || typeof data !== 'object' || !('csrfToken' in data) ||
        typeof data.csrfToken !== 'string' || !data.csrfToken.trim()
      ) {
        throw makeApiError('CSRF 응답에 유효한 토큰이 없습니다.', res.status);
      }
      csrfToken = data.csrfToken;
    })().finally(() => {
      csrfInFlight = null;
    });
    return csrfInFlight;
  }

  async function raw(method: Method, path: string, body: unknown, token?: string): Promise<Response> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers['X-CSRF-Token'] = token;
    const res = await fetchImpl(url(path), {
      method, credentials: 'include', headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) await normalizeError(res);
    return res;
  }

  const core = createAuthCore({
    scope: `${baseUrl}:${refreshPath.includes('/staff/') ? 'staff' : 'member'}`,
    getCsrf: async (force) => {
      if (force) csrfToken = null;
      if (!csrfToken) await bootstrapCsrf();
      return csrfToken!;
    },
    refresh: async (token) => { await raw('POST', refreshPath, undefined, token); csrfToken = null; },
    describeError: (error) => {
      const e = error as Partial<ApiError> | null;
      return { status: e?.status ?? 0, code: e?.code };
    },
  });

  async function normalizeError(res: Response): Promise<never> {
    let message = '요청을 처리하지 못했습니다.';
    let fieldErrors: Record<string, string> | undefined;
    let code: string | undefined;
    try {
      const data = (await res.json()) as {
        message?: string;
        fieldErrors?: Record<string, string>;
        code?: string;
      };
      if (data.message) message = data.message;
      if (data.fieldErrors) fieldErrors = data.fieldErrors;
      if (data.code) code = data.code;
    } catch {
      // 본문 없음/비JSON — 기본 메시지 유지.
    }
    throw makeApiError(message, res.status, { fieldErrors, code });
  }

  async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    // 베이스 URL 미설정이면 same-origin 상대경로로 잘못 나가 404/HTML을 API 오류로
    // 오인하게 된다 → 명확히 fail-closed(설정 누락을 즉시 드러냄).
    if (!baseUrl) {
      throw makeApiError(
        'API 베이스 URL이 설정되지 않았습니다(NEXT_PUBLIC_PULLIM_API). 실 인증 어댑터로 전환 시 필수.',
        0
      );
    }
    const started = generation;
    let res: Response;
    try {
      res = await core.execute((token) => raw(method, path, body, token), {
        mutation: MUTATING.includes(method),
        refresh: path !== refreshPath && !path.endsWith('/login') && !path.endsWith('/logout'),
      });
    } catch (error) {
      if (started !== generation) throw new AuthContextChangedError();
      if (error instanceof AuthSessionExpiredError) {
        generation += 1;
        core.reset();
        csrfToken = null;
        for (const listener of expiryListeners) listener();
      }
      throw error;
    }
    if (started !== generation) throw new AuthContextChangedError();
    const text = await res.text();
    if (started !== generation) throw new AuthContextChangedError();
    if (path.endsWith('/login') || path.endsWith('/logout')) { generation += 1; core.reset(); csrfToken = null; }
    // 204/빈 본문 허용.
    return (text ? JSON.parse(text) : undefined) as T;
  }

  return {
    generation: () => generation,
    subscribeExpired(listener) {
      expiryListeners.add(listener);
      return () => { expiryListeners.delete(listener); };
    },
    request,
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
    del: (path) => request('DELETE', path),
  };
}

/**
 * 기본 클라이언트(앱 런타임). 베이스 URL 미설정이면 `request()`가 즉시 throw(fail-closed)
 * 하므로, 실 어댑터 전환 후 `NEXT_PUBLIC_PULLIM_API`가 빠지면 바로 드러난다.
 * B 미연동 상태에서는 `lib/auth/index.ts`가 여전히 mock 어댑터를 쓰므로 이 클라이언트는
 * PullimApiAuthAdapter로 교체될 때 비로소 사용된다.
 */
export const api: ApiClient = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_PULLIM_API ?? '',
});
