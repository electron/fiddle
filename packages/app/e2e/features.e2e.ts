// Feature specs for what the slices have landed so far.
import { describe, expect, it } from 'vitest';

import { role, useApp } from './harness.ts';

interface WindowStore {
  view?: string;
  fiddle?: { fiddleRev: number; name: string };
}

describe('features', () => {
  const app = useApp();
  const windowStore = async () => (await app().stores(0)).window as WindowStore;

  it('starts a new fiddle from the template @feature documents.new-fiddle', async () => {
    const before = await windowStore();
    await app().runCommand('file.newFiddle', 0);
    await expect
      .poll(async () => (await windowStore()).fiddle?.fiddleRev)
      .toBeGreaterThan(before.fiddle?.fiddleRev ?? 0);
    await app().query(role('tab', 'main.js'));
  });

  it('opens and closes settings from the title bar @feature settings.open', async () => {
    await app().click(role('button', 'Settings'));
    await app().query(role('navigation', 'Settings sections'));
    expect((await windowStore()).view).toBe('settings');

    await app().click(role('button', 'Settings'));
    await app().waitForAbsent(role('navigation', 'Settings sections'));
    expect((await windowStore()).view).toBe('editor');
  });

  it('opens the command palette and closes it with Escape @feature palette.open', async () => {
    await app().runCommand('app.commandPalette', 0);
    await app().query(role('dialog', 'Command palette'));
    await app().press('Escape');
    await app().waitForAbsent(role('dialog', 'Command palette'));
  });
});
