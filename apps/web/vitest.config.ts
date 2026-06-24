import { defineConfig } from 'vitest/config';
export default defineConfig({
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
