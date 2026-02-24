import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globalSetup: 'tests/globalSetup.ts',
    include: ['**/rtl-spec/**/*.spec.{ts,tsx}', '**/tests/**/*-spec.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
  },
});
