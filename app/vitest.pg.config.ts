import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// test:pg (3.1-C7, C7-4; OPTIONAL, outside test:all): the store contract, one suite round trip
// and the service flow against a REAL Postgres at TEST_DATABASE_URL, whose database name must end
// in _test. test/pg/global-setup.ts fails the run with a one-line instruction when the variable
// is missing or names another database; the URL is never printed. One file, run serially.
export default defineConfig({
  resolve: {
    alias: {
      'server-only': fileURLToPath(new URL('./test/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    include: ['test/pg/**/*.test.ts'],
    globalSetup: ['test/pg/global-setup.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
