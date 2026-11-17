import path from 'node:path';

import { defineConfig } from 'vitest/config';

// Unit tests cover the pure TypeScript layers (rules engine and data store).
// They run in plain Node - no simulator, device or React Native runtime needed.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
