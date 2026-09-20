import { defineConfig } from 'vitest/config';
export default defineConfig({
  // esbuild 기본 JSX 변환은 classic(React.createElement) — 전역 `React`가 필요하다.
  // Next 는 automatic 런타임을 쓰므로 컴포넌트 테스트(tsx)에서도 동일하게 맞춘다.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      // `server-only` is a Next.js compile-time sentinel — it throws at runtime in non-RSC
      // environments to prevent server modules from being bundled for the client. In the
      // vitest (jsdom) context there is no bundler guard, so we stub it to an empty module.
      'server-only': new URL('./lib/__stubs__/server-only.ts', import.meta.url).pathname,
      // `@/…` 경로 별칭(tsconfig paths) — 라우트/페이지 테스트가 앱 모듈을 import할 수 있게.
      '@': new URL('.', import.meta.url).pathname.replace(/\/$/, ''),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['lib/**/*.test.{ts,tsx}', 'app/**/*.test.{ts,tsx}'],
    // Node.js v22+ exposes a native (non-functional) `localStorage` on globalThis which
    // prevents vitest's jsdom populateGlobal from overwriting it. The setup file explicitly
    // copies jsdom's working localStorage onto globalThis.
    setupFiles: ['lib/test-setup.ts'],
  },
});
