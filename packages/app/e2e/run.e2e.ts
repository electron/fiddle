// Running the default template. Electron comes from the fixture server's
// mirror, which serves the locally cached zip, so nothing touches the network.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { launchApp, role, type FiddleApp } from './driver.ts';
import { startFixtureServer, type FixtureServer } from './fixtures/server.ts';

describe('run', () => {
  let fixtures: FixtureServer;
  let app: FiddleApp;

  beforeAll(async () => {
    fixtures = await startFixtureServer();
    app = await launchApp({ fixtures });
  });

  afterAll(async () => {
    try {
      await app?.assertClean();
    } finally {
      await app?.close();
      await fixtures?.close();
    }
  });

  it('downloads Electron from the mirror and runs the default template @feature run.start', async () => {
    const [picker] = await app.query(role('button', /^Electron \d+\.\d+\.\d+/));
    const version = /Electron (\S+)/.exec(picker?.name ?? '')?.[1];
    expect(version).toBeTruthy();

    await app.click(role('button', 'Run'));
    const zip = `electron-v${version}-${process.platform}-${process.arch}.zip`;
    await expect
      .poll(() => fixtures.requests.map((r) => `${r.status} ${r.path}`), { timeout: 30_000 })
      .toContain(`200 /electron-mirror/v${version}/${zip}`);

    // Running flips the button to Stop; stopping flips it back.
    await app.query(role('button', 'Stop', { timeout: 60_000 }));
    await app.click(role('button', 'Stop'));
    await app.query(role('button', 'Run', { timeout: 15_000 }));
  }, 120_000);
});
