/** Versioned copy; keep all repositories byte-identical. */
export const AUTH_CORE_VERSION = "1.0.0";

export interface AuthErrorInfo {
  status: number;
  code?: string;
}
export interface AuthCoreConfig {
  /** API origin + member/staff realm; never a user identifier or secret. */
  scope: string;
  getCsrf(force: boolean): Promise<string>;
  /** One network attempt; throw the application's typed error for non-2xx. */
  refresh(csrf: string): Promise<void>;
  describeError(error: unknown): AuthErrorInfo;
  /** Default browser coordination. Set false for request-scoped server instances. */
  browser?: boolean;
  now?: () => number;
  random?: () => number;
  /** Reuse successful refresh for 1s. Set 0 when its response body is required. */
  reuseSuccessMs?: number;
}
export interface AuthOperation {
  mutation?: boolean;
  refresh?: boolean;
  replay?: boolean;
}
export interface AuthCore {
  execute<T>(
    send: (csrf?: string) => Promise<T>,
    options?: AuthOperation
  ): Promise<T>;
  /** false ONLY when the refresh POST itself returns401. Other failures throw. */
  refresh(): Promise<boolean>;
  reset(): void;
  suppressedUntil(): number;
}

/** Bootstrap401 is not evidence that the refresh session expired. */
export class AuthBootstrapError extends Error {
  readonly status = 0;
  readonly statusCode = 0;
  readonly code = "AUTH_CSRF_BOOTSTRAP_FAILED";
  readonly cause: unknown;
  constructor(cause: unknown) {
    super("Unable to initialize request security");
    this.name = "AuthBootstrapError";
    this.cause = cause;
  }
}

export class AuthSessionExpiredError extends Error {
  readonly status = 401;
  readonly statusCode = 401;
  readonly code = "AUTH_SESSION_EXPIRED";
  readonly authExpired = true;
  readonly sessionExpired = true;
  readonly cause: unknown;
  constructor(cause: unknown) {
    super("Authentication session expired");
    this.name = "AuthSessionExpiredError";
    this.cause = cause;
  }
}

export class AuthContextChangedError extends Error {
  readonly status = 0;
  readonly statusCode = 0;
  readonly code = "AUTH_CONTEXT_CHANGED";
  constructor() {
    super("Authentication context changed");
    this.name = "AuthContextChangedError";
  }
}

export function createAuthCore(config: AuthCoreConfig): AuthCore {
  const now = config.now ?? Date.now;
  const random = config.random ?? Math.random;
  const browser = config.browser ?? typeof window !== "undefined";
  const reuseMs = config.reuseSuccessMs ?? 1_000;
  const key = `pullim:auth-core:v1:${config.scope}`;
  let flight: Promise<boolean> | null = null;
  let generation = 0;
  let failures = 0;
  let blockedUntil = 0;
  let failure: { expired: boolean; error: unknown } | null = null;
  let lastSuccess = 0;

  async function csrf(force: boolean): Promise<string> {
    try {
      return await config.getCsrf(force);
    } catch (error) {
      if (config.describeError(error).status === 401)
        throw new AuthBootstrapError(error);
      throw error;
    }
  }
  function info(error: unknown): AuthErrorInfo {
    return config.describeError(error);
  }
  function mismatch(error: unknown): boolean {
    const value = info(error);
    return value.status === 403 && value.code === "CSRF_TOKEN_MISMATCH";
  }
  function recent(): boolean {
    let stamp = lastSuccess;
    if (browser) {
      try {
        stamp = Math.max(
          stamp,
          Number(globalThis.localStorage?.getItem(key)) || 0
        );
      } catch {
        /* storage unavailable */
      }
    }
    const age = now() - stamp;
    return stamp > 0 && age >= 0 && age < reuseMs;
  }
  function markSuccess(): void {
    lastSuccess = now();
    if (browser) {
      try {
        globalThis.localStorage?.setItem(key, String(lastSuccess));
      } catch {
        /* tab-local coordination remains */
      }
    }
  }
  async function locked<T>(run: () => Promise<T>): Promise<T> {
    const locks = browser ? globalThis.navigator?.locks : undefined;
    if (!locks) return run();
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 10_000);
    let entered = false;
    try {
      return await locks.request(key, { signal: abort.signal }, async () => {
        entered = true;
        clearTimeout(timer);
        return run();
      });
    } catch (error) {
      // Only lock acquisition timeout falls back; never replay a failed network request.
      if (!entered && abort.signal.aborted) return run();
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  async function refreshAttempt(assertCurrent: () => void): Promise<boolean> {
    assertCurrent();
    const token = await csrf(true);
    assertCurrent();
    try {
      await config.refresh(token);
      return true;
    } catch (error) {
      if (mismatch(error)) {
        const fresh = await csrf(true);
        assertCurrent();
        try {
          await config.refresh(fresh);
          return true;
        } catch (retryError) {
          if (info(retryError).status === 401) return false;
          throw retryError;
        }
      }
      if (info(error).status === 401) return false;
      throw error;
    }
  }
  function refresh(): Promise<boolean> {
    if (flight) return flight;
    if (recent()) return Promise.resolve(true);
    if (now() < blockedUntil && failure) {
      return failure.expired
        ? Promise.resolve(false)
        : Promise.reject(failure.error);
    }
    const gen = generation;
    const assertCurrent = () => {
      if (gen !== generation) throw new AuthContextChangedError();
    };
    const current = locked(async () => {
      assertCurrent();
      if (recent()) return true;
      const ok = await refreshAttempt(assertCurrent);
      if (gen !== generation) throw new AuthContextChangedError();
      if (ok) markSuccess(); // Publish before releasing the cross-tab lock.
      return ok;
    })
      .then(
        (ok) => {
          if (gen !== generation) throw new AuthContextChangedError();
          if (gen === generation) {
            if (ok) {
              failures = 0;
              blockedUntil = 0;
              failure = null;
            } else recordFailure(true, undefined);
          }
          return ok;
        },
        (error: unknown) => {
          if (gen === generation) recordFailure(false, error);
          throw error;
        }
      )
      .finally(() => {
        if (flight === current) flight = null;
      });
    flight = current;
    return current;
  }
  function recordFailure(expired: boolean, error: unknown): void {
    failures += 1;
    const base = Math.min(5_000 * 2 ** (failures - 1), 60_000);
    blockedUntil = now() + Math.round(base * (1 + random() * 0.25));
    failure = { expired, error };
  }
  return {
    refresh,
    suppressedUntil: () => blockedUntil,
    reset() {
      generation += 1;
      flight = null;
      failures = 0;
      blockedUntil = 0;
      failure = null;
      lastSuccess = 0;
      if (browser) {
        try {
          globalThis.localStorage?.removeItem(key);
        } catch {
          /* optional storage */
        }
      }
    },
    async execute<T>(
      send: (csrf?: string) => Promise<T>,
      options: AuthOperation = {}
    ): Promise<T> {
      const gen = generation;
      const assertCurrent = () => {
        if (gen !== generation) throw new AuthContextChangedError();
      };
      let usedCsrf = false;
      async function attempt(forceCsrf = false): Promise<T> {
        assertCurrent();
        const token = options.mutation ? await csrf(forceCsrf) : undefined;
        assertCurrent();
        try {
          const result = await send(token);
          assertCurrent();
          return result;
        } catch (error) {
          assertCurrent();
          if (
            !options.mutation ||
            options.replay === false ||
            usedCsrf ||
            !mismatch(error)
          )
            throw error;
          usedCsrf = true;
          const fresh = await csrf(true);
          assertCurrent();
          const result = await send(fresh);
          assertCurrent();
          return result;
        }
      }
      try {
        return await attempt();
      } catch (error) {
        if (
          error instanceof AuthBootstrapError ||
          info(error).status !== 401 ||
          options.refresh === false ||
          options.replay === false
        )
          throw error;
        assertCurrent();
        if (!(await refresh())) throw new AuthSessionExpiredError(error);
        assertCurrent();
        return attempt(true);
      }
    },
  };
}
