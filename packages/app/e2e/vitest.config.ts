// The e2e Vitest project: `yarn test:e2e` (root). It builds the test build once
// (./global-setup.ts), then runs every packages/app/e2e/*.e2e.ts in parallel
// forks. Each spec file launches its own app, display and fixture server.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e',
    root: path.dirname(fileURLToPath(import.meta.url)),
    include: ['*.e2e.ts'],
    environment: 'node',
    pool: 'forks',
    globalSetup: ['./global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
