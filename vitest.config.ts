import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      exclude: ['**/*.json', '**/*.less', 'tests/**'],
    },
    environment: 'jsdom',
    globalSetup: 'tests/globalSetup.ts',
    include: ['**/tests/**/*.spec.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
  },
});
