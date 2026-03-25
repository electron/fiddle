import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globalSetup: 'tests/globalSetup.ts',
    include: ['**/tests/**/*.spec.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
  },
});
