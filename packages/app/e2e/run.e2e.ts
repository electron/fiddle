// Running the default template. Electron comes from the fixture server's
// mirror, which serves the locally cached zip, so nothing touches the network.
import { describe, expect, it } from 'vitest';

import { role, text, useApp, windowState } from './harness.ts';

describe('run', () => {
  const app = useApp();

  it('downloads Electron from the mirror and runs the default template', async () => {
    const [picker] = await app().query(role('button', /^Electron \d+\.\d+\.\d+/));
    const version = /Electron (\S+)/.exec(picker?.name ?? '')?.[1];
    expect(version).toBeTruthy();

    await app().click(role('button', 'Run'));
    const zip = `electron-v${version}-${process.platform}-${process.arch}.zip`;
    await expect
      .poll(() => app.fixtures().requests.map((r) => `${r.status} ${r.path}`), {
        timeout: 30_000,
      })
      .toContain(`200 /electron-mirror/v${version}/${zip}`);

    // Running flips the button to Stop; stopping flips it back. The inspector line shows the
    // fiddle's main process came up: a Chromium start-up abort (no usable sandbox) ends the run first.
    await app().query(role('button', 'Stop', { timeout: 60_000 }));
    await app().query(text(/^Inspector listening on /, { timeout: 60_000 }));
    await app().click(role('button', 'Stop'));
    await app().query(role('button', 'Run', { timeout: 15_000 }));
  }, 120_000);

  it('reports the start and the end of the run in the console', async () => {
    // The version and the app name, then how it ended.
    await app().query(text(/^Electron v\d+\.\d+\.\d+ started as ".+"$/));
    await app().query(text(/^Electron (was stopped by SIG\w+|exited with code -?\d+)$/));
    expect((await windowState(app())).run?.status ?? 'ready').toBe('ready');
  });

  it('clears the console with CmdOrCtrl+K while it has focus', async () => {
    const before = (await windowState(app())).run?.clearedSeq ?? 0;
    await app().press('CmdOrCtrl+K', role('textbox', 'Filter output'));
    await expect
      .poll(async () => (await windowState(app())).run?.clearedSeq ?? 0)
      .toBeGreaterThan(before);
    await app().waitForAbsent(text(/^Electron v\d+\.\d+\.\d+ started as/));
  });

  it('runs with F5, reopening a hidden console, and stops with CmdOrCtrl+R', async () => {
    await app().runCommand('view.toggleConsole');
    await app().waitForAbsent(role('region', 'Console'));
    await app().press('F5');
    await app().query(role('button', 'Stop', { timeout: 60_000 }));
    await app().query(role('region', 'Console'));
    await app().query(text(/^Inspector listening on /, { timeout: 60_000 }));
    await app().press('CmdOrCtrl+R');
    await app().query(role('button', 'Run', { timeout: 15_000 }));
  }, 90_000);

  it('clears the console from its button', async () => {
    await app().query(text(/^Electron v\d+\.\d+\.\d+ started as/));
    await app().click(role('button', 'Clear console'));
    await app().waitForAbsent(text(/^Electron v\d+\.\d+\.\d+ started as/));
  });
});
