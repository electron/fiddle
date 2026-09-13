/** Vitest glue for specs. See ./README.md. */
import { afterAll, beforeAll, beforeEach } from 'vitest';

import { launchApp, type FiddleApp, type LaunchOptions } from './driver.ts';

export { FIXTURE_GIST_ID, role, text, type FiddleApp } from './driver.ts';

/**
 * One app per spec file: launched before the first test and closed after the
 * last. Call the returned getter inside tests. When a test fails, a screenshot,
 * the accessibility snapshot and log tails are printed and the temp dir is
 * kept. After the last test, any isolation violation (a non-loopback request,
 * an unscripted dialog, a lost renderer) fails the file.
 */
export function useApp(options: LaunchOptions = {}): () => FiddleApp {
  let app: FiddleApp | undefined;

  beforeAll(async () => {
    app = await launchApp(options);
  });

  beforeEach((context) => {
    context.onTestFailed(async () => {
      if (!app) return;
      app.markFailed();
      console.error(await app.diagnostics(context.task.name));
    });
  });

  afterAll(async () => {
    if (!app) return;
    try {
      await app.assertClean();
    } finally {
      await app.close();
    }
  });

  return () => {
    if (!app) throw new Error('useApp(): the app is only available inside tests and hooks');
    return app;
  };
}
