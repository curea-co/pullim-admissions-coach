import {
  createAuthCore,
  AuthContextChangedError,
  AuthBootstrapError,
} from "./auth-core";

/** Runner-independent shared contract. Each repository registers this with its own test(). */
export function authCoreContract(
  test: (name: string, run: () => Promise<void>) => void
): void {
  const assert = (value: unknown, message: string) => {
    if (!value) throw new Error(message);
  };
  const error = (status: number, code = "") =>
    Object.assign(new Error(code), { status, code });
  const describeError = (value: unknown) =>
    value as { status: number; code?: string };
  const make = (
    refresh: (token: string) => Promise<void>,
    getCsrf: (force: boolean) => Promise<string> = async () => "csrf"
  ) =>
    createAuthCore({
      scope: "test:member",
      refresh,
      getCsrf,
      describeError,
      browser: false,
      random: () => 0,
    });
  test("mismatch recovers once; Origin and permission never replay", async () => {
    for (const code of [
      "CSRF_TOKEN_MISMATCH",
      "CSRF_ORIGIN_REJECTED",
      "FORBIDDEN",
    ]) {
      let calls = 0;
      const core = make(async () => undefined);
      await core
        .execute(
          async () => {
            calls++;
            throw error(403, code);
          },
          { mutation: true }
        )
        .catch(() => undefined);
      assert(
        calls === (code === "CSRF_TOKEN_MISMATCH" ? 2 : 1),
        "unexpected recovery count"
      );
    }
  });
  test("401 refreshes once and replays original once", async () => {
    let refreshes = 0;
    let requests = 0;
    const core = make(async () => {
      refreshes++;
    });
    await core
      .execute(async () => {
        requests++;
        throw error(401);
      })
      .catch(() => undefined);
    assert(refreshes === 1 && requests === 2, "401 loop");
  });
  test("refresh single-flight and error-preserving backoff", async () => {
    let calls = 0;
    const failure = error(403, "CSRF_ORIGIN_REJECTED");
    const core = make(async () => {
      calls++;
      throw failure;
    });
    const values = await Promise.all([
      core.refresh().catch((e) => e),
      core.refresh().catch((e) => e),
    ]);
    const next = await core.refresh().catch((e) => e);
    assert(
      calls === 1 && values.every((v) => v === failure) && next === failure,
      "backoff hides failure"
    );
  });
  test("only refresh POST401 expires; bootstrap401 is error", async () => {
    assert(
      (await make(async () => {
        throw error(401);
      }).refresh()) === false,
      "refresh401 classification"
    );
    const core = make(
      async () => undefined,
      async () => {
        throw error(401);
      }
    );
    assert(
      (await core.refresh().catch((e) => e)) instanceof AuthBootstrapError,
      "bootstrap401 misclassified"
    );
  });
  test("refresh mismatch gets one recovery", async () => {
    let calls = 0;
    const core = make(async () => {
      calls++;
      if (calls === 1) throw error(403, "CSRF_TOKEN_MISMATCH");
    });
    assert(
      (await core.refresh()) && calls === 2,
      "refresh mismatch not recovered"
    );
  });
  test("one operation shares mismatch budget across refresh", async () => {
    let calls = 0;
    const core = make(async () => undefined);
    await core
      .execute(
        async () => {
          calls++;
          throw error(calls === 2 ? 401 : 403, "CSRF_TOKEN_MISMATCH");
        },
        { mutation: true }
      )
      .catch(() => undefined);
    assert(calls === 3, "budget repeated after refresh");
  });
  test("nonreplayable mutations never refresh or retry", async () => {
    let refreshes = 0;
    let calls = 0;
    const core = make(async () => {
      refreshes++;
    });
    await core
      .execute(
        async () => {
          calls++;
          throw error(401);
        },
        { mutation: true, replay: false }
      )
      .catch(() => undefined);
    assert(calls === 1 && refreshes === 0, "nonreplayable operation repeated");
  });
  test("refresh success forces fresh mutation csrf", async () => {
    const forces: boolean[] = [];
    let calls = 0;
    const core = make(
      async () => undefined,
      async (force) => {
        forces.push(force);
        return "csrf";
      }
    );
    await core.execute(
      async () => {
        if (++calls === 1) throw error(401);
      },
      { mutation: true }
    );
    assert(
      forces.join(",") === "false,true,true",
      "stale csrf used after rotation"
    );
  });
  test("reset during refresh prevents old request replay", async () => {
    let release: (() => void) | undefined;
    let entered: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const core = make(async () => {
      entered?.();
      await pending;
    });
    let calls = 0;
    const result = core
      .execute(async () => {
        calls++;
        throw error(401);
      })
      .catch((e) => e);
    await started;
    core.reset();
    release?.();
    assert(
      (await result) instanceof AuthContextChangedError && calls === 1,
      "old operation replayed"
    );
  });
  test("reset during csrf recovery prevents old mutation replay", async () => {
    let calls = 0;
    let bootstraps = 0;
    let release: (() => void) | undefined;
    let entered: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const core = make(
      async () => undefined,
      async () => {
        if (++bootstraps === 2) {
          entered?.();
          await pending;
        }
        return "csrf";
      }
    );
    const result = core
      .execute(
        async () => {
          calls++;
          throw error(403, "CSRF_TOKEN_MISMATCH");
        },
        { mutation: true }
      )
      .catch((e) => e);
    await started;
    core.reset();
    release?.();
    assert(
      (await result) instanceof AuthContextChangedError && calls === 1,
      "old mutation replayed"
    );
  });
  test("reset while refresh csrf is pending prevents refresh POST", async () => {
    let posts = 0;
    let release: (() => void) | undefined;
    let entered: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const core = make(
      async () => {
        posts++;
      },
      async () => {
        entered?.();
        await pending;
        return "csrf";
      }
    );
    const result = core.refresh().catch((e) => e);
    await started;
    core.reset();
    release?.();
    assert(
      (await result) instanceof AuthContextChangedError && posts === 0,
      "stale refresh sent"
    );
  });
  test("browser lock publishes success before releasing and reset cancels waiting work", async () => {
    const nav = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    const storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    const values = new Map<string, string>();
    let enter: (() => void) | undefined;
    let wait = false;
    let posts = 0;
    let published = false;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => {
          values.set(key, value);
        },
        removeItem: (key: string) => {
          values.delete(key);
        },
      },
    });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        locks: {
          request: async (
            key: string,
            options: unknown,
            run: () => Promise<boolean>
          ) => {
            assert(Boolean(key) && Boolean(options), "lock parameters missing");
            if (wait)
              await new Promise<void>((resolve) => {
                enter = resolve;
              });
            const result = await run();
            published = values.size > 0;
            return result;
          },
        },
      },
    });
    try {
      const core = createAuthCore({
        scope: "contract:member",
        browser: true,
        getCsrf: async () => "csrf",
        refresh: async () => {
          posts++;
        },
        describeError,
      });
      await core.refresh();
      assert(published, "success stamp written after lock released");
      core.reset();
      wait = true;
      const result = core.refresh().catch((e) => e);
      core.reset();
      enter?.();
      assert(
        (await result) instanceof AuthContextChangedError && posts === 1,
        "waiting old refresh sent"
      );
    } finally {
      if (nav) Object.defineProperty(globalThis, "navigator", nav);
      else Reflect.deleteProperty(globalThis, "navigator");
      if (storage) Object.defineProperty(globalThis, "localStorage", storage);
      else Reflect.deleteProperty(globalThis, "localStorage");
    }
  });
  test("reset rejects a late successful identity response", async () => {
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const core = make(async () => undefined);
    const result = core
      .execute(async () => {
        await pending;
        return { user: "old" };
      })
      .catch((e) => e);
    core.reset();
    release?.();
    assert(
      (await result) instanceof AuthContextChangedError,
      "old identity returned"
    );
  });
}
