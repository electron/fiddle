// The e2e Vitest project: `yarn test:e2e` (root). It builds the test build once
// (./global-setup.ts), then runs every packages/app/e2e/*.e2e.ts in parallel
// forks. Each spec file launches its own app, display and fixture server.
//
// Workers: FIDDLE_E2E_WORKERS sets how many spec files (apps) run at once. The
// default is Vitest's (one per core but one) on Linux, where each app has its
// own Xvfb display, and at most 4 on macOS and Windows, where the apps share
// the desktop, the GPU and the clipboard with whoever runs them.
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

function maxWorkers(): number | undefined {
  const given = Number(process.env.FIDDLE_E2E_WORKERS);
  if (Number.isInteger(given) && given > 0) return given;
  if (process.platform === 'linux') return undefined;
  return Math.max(1, Math.min(4, Math.floor(os.availableParallelism() / 2)));
}

const workers = maxWorkers();

export default defineConfig({
  test: {
    name: 'e2e',
    root: path.dirname(fileURLToPath(import.meta.url)),
    include: ['*.e2e.ts'],
    environment: 'node',
    pool: 'forks',
    ...(workers === undefined ? {} : { maxWorkers: workers }),
    globalSetup: ['./global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Polls wait on IPC and the fixture server; Vitest's default is 1 s.
    expect: { poll: { timeout: 10_000 } },
  },
});
