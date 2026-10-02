import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// 'server-only' throws outside a React Server bundle; under vitest it maps to an empty stub.
export default defineConfig({
  resolve: {
    alias: {
      'server-only': fileURLToPath(new URL('./test/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
