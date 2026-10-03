import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

// 'server-only' throws outside a React Server bundle; under vitest it maps to an empty stub.
// Timeouts: the db/store tests start PGlite (WASM Postgres; ~2-3 s cold per worker, ~1 s per
// instance); in parallel with them CPU-bound tests (icons) exceed the 5 s default. The limits only
// bound a hang -- no assertion depends on them. test/pg needs a live database: only test:pg
// (vitest.pg.config.ts) runs it.
export default defineConfig({
  resolve: {
    alias: {
      'server-only': fileURLToPath(new URL('./test/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    exclude: [...configDefaults.exclude, 'test/pg/**'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
