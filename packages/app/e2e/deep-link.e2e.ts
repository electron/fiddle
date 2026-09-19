// Deep links through the single-instance lock: a second launch of the test
// build with the same userData forwards its argv to the running app and quits.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { APP_DIR, electronArgs, TEST_BUILD_DIR } from './driver.ts';
import { FIXTURE_GIST_ID, useApp, windowState } from './harness.ts';

describe('deep links', () => {
  const app = useApp();

  /** Launches a second instance; resolves with its exit code. */
  const secondInstance = (...args: string[]) =>
    new Promise<number | null>((resolve, reject) => {
      const electron = createRequire(path.join(APP_DIR, 'package.json'))(
        'electron',
      ) as string;
      const testDir = app().testDir ?? '';
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        FIDDLE_TEST_MODE: '1',
        FIDDLE_TEST_DIR: testDir,
        FIDDLE_TEST_FIXTURE_URL: app.fixtures().url,
        ELECTRON_FIDDLE_DRIVER_SOCKET: path.join(testDir, 'second-instance.sock'),
      };
      delete env.ELECTRON_RUN_AS_NODE;
      delete env.NODE_OPTIONS;
      const child = spawn(
        electron,
        [...electronArgs(), '--ozone-platform=headless', TEST_BUILD_DIR, ...args],
        { env, stdio: 'ignore' },
      );
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('the second instance did not exit within 20 s'));
      }, 20_000);
      child.once('error', reject);
      child.once('exit', (code) => {
        clearTimeout(timer);
        resolve(code);
      });
    });

  it('forwards a link from a second launch and asks before loading it', async () => {
    await app().queueDialog('messageBox', { button: 'Load' });
    expect(
      await secondInstance(`electron-fiddle://gist/fiddle-e2e/${FIXTURE_GIST_ID}`),
    ).toBe(0);
    await expect
      .poll(async () => (await windowState(app())).fiddle.source.gistId, {
        timeout: 15_000,
      })
      .toBe(FIXTURE_GIST_ID);

    const prompt = (await app().dialogs()).find(
      (dialog) => dialog.options.message === 'Load this gist?',
    );
    expect(prompt).toMatchObject({ kind: 'messageBox', scripted: true });
    expect(String(prompt?.options.detail)).toContain('Owner: fiddle-e2e');
  });

  it('keeps one window when a second launch has no link', async () => {
    expect(await secondInstance()).toBe(0);
    expect(await app().windows()).toHaveLength(1);
  });
});
