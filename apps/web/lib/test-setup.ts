// vitest setup — fix localStorage/sessionStorage visibility under Node.js v22+.
//
// Node.js v22+ exposes a non-functional `localStorage` getter on globalThis (returns undefined
// unless --localstorage-file is set). vitest's populateGlobal() skips keys that already exist
// on global, so jsdom's real localStorage never replaces the Node stub.
//
// Workaround: vitest exposes the JSDOM instance as window.jsdom (set in setupVM).
// We grab jsdom.window.localStorage (the real one) and force-define it on globalThis.
const _w = globalThis as unknown as Record<string, unknown>;
const _jsdom = _w['jsdom'] as { window: Record<string, unknown> } | undefined;
if (_jsdom?.window) {
  const ls = _jsdom.window['localStorage'] as Storage;
  const ss = _jsdom.window['sessionStorage'] as Storage;
  if (ls) {
    Object.defineProperty(globalThis, 'localStorage', {
      get: () => ls,
      set: () => {},
      configurable: true,
      enumerable: true,
    });
  }
  if (ss) {
    Object.defineProperty(globalThis, 'sessionStorage', {
      get: () => ss,
      set: () => {},
      configurable: true,
      enumerable: true,
    });
  }
}
