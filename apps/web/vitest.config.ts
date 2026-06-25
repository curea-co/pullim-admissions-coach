import { defineConfig } from 'vitest/config';
export default defineConfig({
  resolve: {
    alias: {
      // `server-only` is a Next.js compile-time sentinel — it throws at runtime in non-RSC
      // environments to prevent server modules from being bundled for the client. In the
      // vitest (jsdom) context there is no bundler guard, so we stub it to an empty module.
      'server-only': new URL('./lib/__stubs__/server-only.ts', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['lib/**/*.test.ts'],
    // Node.js v22+ exposes a native (non-functional) `localStorage` on globalThis which
    // prevents vitest's jsdom populateGlobal from overwriting it. The setup file explicitly
    // copies jsdom's working localStorage onto globalThis.
    setupFiles: ['lib/test-setup.ts'],
  },
});
