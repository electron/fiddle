// Session restore across a relaunch: the second app reuses the first one's
// userData (FIDDLE_TEST_DIR), so it sees what the first one saved on quit.
import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import { launchApp, role, type FiddleApp } from './driver.ts';
import { startFixtureServer } from './fixtures/server.ts';
import { windowState } from './harness.ts';

describe('session', () => {
  it('reopens every window with its fiddle, version and layout @feature new.session-restore', async () => {
    const fixtures = await startFixtureServer();
    let first: FiddleApp | undefined;
    let second: FiddleApp | undefined;
    try {
      first = await launchApp({ fixtures, keepArtifacts: true });
      await first.click(role('button', /^Electron 44\.3\.0\b/));
      await first.click(role('option', /^Electron 43\.7\.0\b/));
      await expect
        .poll(async () => (await windowState(first!, 0)).fiddle.versionRef)
        .toEqual({ kind: 'release', version: '43.7.0' });
      await first.click(role('button', 'Split editor'));
      await expect.poll(async () => (await windowState(first!, 0)).layout.split).not.toBeNull();
      await first.runCommand('app.newWindow');
      await first.waitForWindow(1);
      const before = [await windowState(first, 0), await windowState(first, 1)];
      await first.waitForIdle();
      await first.assertClean();
      await first.close();

      second = await launchApp({ fixtures, env: { FIDDLE_TEST_DIR: first.testDir ?? '' } });
      await second.waitForWindow(1);
      const after = [await windowState(second, 0), await windowState(second, 1)];
      const summary = (states: typeof before) =>
        states
          .map((s) => ({ name: s.fiddle.name, version: s.fiddle.versionRef, split: s.layout.split }))
          .sort((a, b) => a.name.localeCompare(b.name));
      expect(summary(after)).toEqual(summary(before));
      await second.assertClean();
    } finally {
      await second?.close();
      if (first?.testDir) fs.rmSync(first.testDir, { recursive: true, force: true });
      await fixtures.close();
    }
  }, 120_000);
});
