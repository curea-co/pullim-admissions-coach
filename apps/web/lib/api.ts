'use client';

/**
 * pullim-api HTTP 클라이언트 (B: 실 인증 연동).
 *
 * 설계: docs/superpowers/specs/2026-06-24-auth-mypage-design.md §4·§6·§8.
 * - 모든 요청 `credentials: 'include'`(httpOnly 쿠키 세션).
 * - CSRF: `GET /auth/csrf`로 토큰 부트스트랩 → 변경 요청에 `X-CSRF-Token` echo.
 * - 401: `POST /auth/refresh` **single-flight**(동시 만료 시 1회만) 후 원요청 1회 재시도.
 *   refresh 자체의 401/403에는 재시도하지 않는다(무한 루프 방지).
 * - 403(CSRF): `/auth/csrf` 재부트스트랩 후 1회 재시도.
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
  let csrfToken: string | null = null;
  let refreshInFlight: Promise<boolean> | null = null;

  const url = (path: string) => `${baseUrl}${path}`;

  async function bootstrapCsrf(): Promise<void> {
    // TODO(B): pullim-api `/auth/csrf` 실제 응답 형태 확인.
    // 본 스캐폴드는 응답 본문 `{ csrfToken }`을 가정(쿠키가 api-호스트 전용이면 웹 JS가
    // 못 읽으므로 본문 토큰이 안전). 공유 부모 도메인 쿠키면 쿠키에서 읽도록 교체.
    const res = await fetchImpl(url(csrfPath), { credentials: 'include' });
    if (!res.ok) throw makeApiError('CSRF 부트스트랩 실패', res.status);
    const data = (await res.json().catch(() => ({}))) as { csrfToken?: string };
    csrfToken = data.csrfToken ?? null;
  }

  /** single-flight refresh. 동시 만료 요청은 진행 중 Promise 하나를 공유. 성공 여부 반환. */
  function refreshOnce(): Promise<boolean> {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
      try {
        const res = await fetchImpl(url(refreshPath), {
          method: 'POST',
          credentials: 'include',
          headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
        });
        return res.ok; // refresh의 401/403 → false(재귀 금지)
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
    return refreshInFlight;
  }

  async function raw(method: Method, path: string, body: unknown): Promise<Response> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (MUTATING.includes(method)) {
      if (csrfToken === null) await bootstrapCsrf();
      if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    }
    return fetchImpl(url(path), {
      method,
      credentials: 'include',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  async function normalizeError(res: Response): Promise<never> {
    let message = '요청을 처리하지 못했습니다.';
    let fieldErrors: Record<string, string> | undefined;
    try {
      const data = (await res.json()) as { message?: string; fieldErrors?: Record<string, string> };
      if (data.message) message = data.message;
      if (data.fieldErrors) fieldErrors = data.fieldErrors;
    } catch {
      // 본문 없음/비JSON — 기본 메시지 유지.
    }
    throw makeApiError(message, res.status, { fieldErrors });
  }

  async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    const isRefresh = path === refreshPath;
    let res = await raw(method, path, body);

    // 403(CSRF) → 재부트스트랩 후 1회 재시도.
    if (res.status === 403 && !isRefresh) {
      await bootstrapCsrf();
      res = await raw(method, path, body);
    }

    // 401 → single-flight refresh → 1회 재시도. refresh 자체는 재시도 안 함(재귀 금지).
    if (res.status === 401 && !isRefresh) {
      const ok = await refreshOnce();
      if (!ok) {
        throw makeApiError('인증이 만료되었습니다. 다시 로그인해 주세요.', 401, {
          authExpired: true,
        });
      }
      res = await raw(method, path, body);
    }

    if (!res.ok) await normalizeError(res);
    // 204/빈 본문 허용.
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  return {
    request,
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
    del: (path) => request('DELETE', path),
  };
}

/**
 * 기본 클라이언트(앱 런타임). 베이스 URL이 없으면(미설정) 호출 시 명확히 실패.
 * B 미연동 상태에서는 `lib/auth/index.ts`가 여전히 mock 어댑터를 쓰므로 이 클라이언트는
 * PullimApiAuthAdapter로 교체될 때 비로소 사용된다.
 */
export const api: ApiClient = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_PULLIM_API ?? '',
});
