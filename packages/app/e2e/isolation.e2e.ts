// Test mode's isolation: no real network, fixed locale and time zone, temp dirs.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { launchApp, type FiddleApp } from './driver.ts';
import { startFixtureServer, type FixtureServer } from './fixtures/server.ts';

describe('isolation', () => {
  let fixtures: FixtureServer;
  let app: FiddleApp;

  beforeAll(async () => {
    fixtures = await startFixtureServer();
    app = await launchApp({ fixtures });
  });

  afterAll(async () => {
    await app?.close();
    await fixtures?.close();
  });

  it('serves loopback fixtures and blocks every other host, from Node and Chromium', async () => {
    expect(await app.mainHook('harness.fetch', `${fixtures.url}/releases.json`)).toEqual({
      status: 200,
    });
    expect(fixtures.requests).toContainEqual(
      expect.objectContaining({ method: 'GET', path: '/releases.json', status: 200 }),
    );

    expect(await app.mainHook('harness.fetch', 'https://example.com/')).toHaveProperty(
      'error',
    );
    expect(await app.mainHook('harness.netFetch', 'https://example.org/')).toHaveProperty(
      'error',
    );
    const violations = await app.violations();
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.stringContaining('https://example.com/'),
        expect.stringContaining('https://example.org/'),
      ]),
    );
  });

  it('fixes the locale and time zone in the renderer', async () => {
    expect(
      await app.evaluate(
        '[navigator.language, Intl.DateTimeFormat().resolvedOptions().timeZone]',
      ),
    ).toEqual(['en-US', 'UTC']);
  });

  it('keeps userData in the test dir', async () => {
    expect(app.testDir).toBeTruthy();
    const logs = await app.logs();
    expect(logs.main.join('\n')).toContain('driver listening');
  });
});
