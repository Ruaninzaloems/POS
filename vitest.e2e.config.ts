import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client/src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/pos-e2e-api.test.ts'],
    testTimeout: 30000,
    sequence: { concurrent: false },
  },
});
