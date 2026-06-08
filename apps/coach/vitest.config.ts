import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// `server-only` ships a client-component guard that throws when imported outside
// a Next Server Component. Under vitest (node) it resolves to that guard and
// breaks module load, so alias it to an empty module for tests. The directive
// stays in source and remains enforced in the real Next build.
const here = dirname(fileURLToPath(import.meta.url))
export default defineConfig({
  test: { globals: true, environment: 'node', include: ['lib/**/*.test.ts'] },
  resolve: { alias: { 'server-only': resolve(here, 'test/empty.ts') } },
})
