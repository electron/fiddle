// Deep links through the single-instance lock: a second launch of the test
// build with the same userData forwards its argv to the running app and quits.
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { spawnTestBuild } from './driver.ts';
import { FIXTURE_GIST_ID, useApp, windowState } from './harness.ts';

describe('deep links', () => {
  const app = useApp();

  /** Launches a second instance; resolves with its exit code. */
  const secondInstance = (...args: string[]) =>
    new Promise<number | null>((resolve, reject) => {
      const testDir = app().testDir ?? '';
      const child = spawnTestBuild(
        ['--ozone-platform=headless', ...args],
        {
          FIDDLE_TEST_DIR: testDir,
          FIDDLE_TEST_FIXTURE_URL: app.fixtures().url,
          ELECTRON_FIDDLE_DRIVER_SOCKET: path.join(testDir, 'second-instance.sock'),
        },
        { stdio: 'ignore', timeout: 20_000, killSignal: 'SIGKILL' },
      );
      child.once('error', reject);
      child.once('exit', (code, signal) =>
        signal === 'SIGKILL'
          ? reject(new Error('the second instance did not exit within 20 s'))
          : resolve(code),
      );
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
