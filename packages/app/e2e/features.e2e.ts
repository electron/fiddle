// Core flows: new fiddle, settings, the command palette, Show Me examples and the tour.
import { describe, expect, it } from 'vitest';

import { openedUrls, role, text, useApp, windowState } from './harness.ts';

describe('features', () => {
  const app = useApp();

  it('downloads the template for the current major at startup', async () => {
    await expect
      .poll(() => app.fixtures().requests.map((r) => `${r.status} ${r.path}`))
      .toContain('200 /minimal-repro/archive/44-x-y.zip');
  });

  it('starts a new fiddle from the template with CmdOrCtrl+N', async () => {
    const before = await windowState(app());
    await app().press('CmdOrCtrl+N');
    await expect
      .poll(async () => (await windowState(app())).fiddle.fiddleRev)
      .toBeGreaterThan(before.fiddle.fiddleRev);
    const after = await windowState(app());
    expect(after.fiddle).toMatchObject({ dirty: false, modules: {} });
    expect(after.fiddle.name).not.toBe(before.fiddle.name);
    await app().query(role('tab', 'main.js'));
  });

  it('opens settings with CmdOrCtrl+,', async () => {
    await app().press('CmdOrCtrl+,');
    await app().query(role('navigation', 'Settings sections'));
    expect((await windowState(app())).view).toBe('settings');
    await app().click(role('button', 'Close settings'));
    await app().waitForAbsent(role('navigation', 'Settings sections'));
    expect((await windowState(app())).view).toBe('editor');
  });

  // Focus stays on the title bar button, outside the page.
  it('opens settings from the title bar and closes them with Escape', async () => {
    await app().click(role('button', 'Settings'));
    await app().query(role('navigation', 'Settings sections'));
    await app().press('Escape');
    await app().waitForAbsent(role('navigation', 'Settings sections'));
  });

  // Focus stays where it was before the shortcut, outside the page.
  it('closes settings opened with CmdOrCtrl+, on Escape', async () => {
    await app().press('CmdOrCtrl+,');
    await app().query(role('navigation', 'Settings sections'));
    await app().press('Escape');
    await app().waitForAbsent(role('navigation', 'Settings sections'));
    expect((await windowState(app())).view).toBe('editor');
  });

  it('runs a command from the palette, which shows keybindings', async () => {
    await app().press('CmdOrCtrl+Shift+P');
    await app().query(role('dialog', 'Command palette'));
    await app().query(role('option', /^New window .*N$/));

    await app().type('toggle sidebar', role('combobox', 'Command palette'));
    await app().query(role('option', 'Toggle sidebar'));
    await app().press('Enter');
    await app().waitForAbsent(role('dialog', 'Command palette'));
    await expect.poll(async () => (await windowState(app())).layout.sidebar).toBe(false);

    await app().runCommand('view.toggleSidebar');
    await expect.poll(async () => (await windowState(app())).layout.sidebar).toBe(true);
  });

  it('offers the menu actions that have no shortcut', async () => {
    await app().press('CmdOrCtrl+Shift+P');
    for (const name of [
      'Publish to gist…',
      'Save as Forge project…',
      'Package',
      'Make installers',
      'Toggle soft wrap',
      'Toggle minimap',
      'Show welcome tour',
      'Electron Fiddle on GitHub',
      'Electron on GitHub',
      'Report an issue',
      'About Electron Fiddle',
    ]) {
      // An exact name: no keybinding follows the label.
      await app().query(role('option', name));
    }
    await app().press('Escape');
    await app().waitForAbsent(role('dialog', 'Command palette'));

    // Each link asks before opening in the browser.
    for (const id of [
      'help.fiddleRepository',
      'help.electronRepository',
      'help.reportIssue',
    ]) {
      await app().queueDialog('messageBox', { button: 'Open link' });
      await app().runCommand(id);
    }
    await expect
      .poll(() => openedUrls(app()))
      .toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^https:\/\/github\.com\/electron\/fiddle\/?$/),
          expect.stringMatching(/^https:\/\/github\.com\/electron\/electron\/?$/),
          expect.stringMatching(/^https:\/\/github\.com\/electron\/fiddle\/issues/),
        ]),
      );
  });

  it('loads a Show Me example from the palette', async () => {
    await app().press('CmdOrCtrl+Shift+P');
    await app().type('BrowserWindow', role('combobox', 'Command palette'));
    await app().query(role('option', /^BrowserWindow\b/));
    await app().press('Enter');
    await expect
      .poll(async () => (await windowState(app())).fiddle.source.templateName)
      .toBe('BrowserWindow');
    await app().query(role('tab', 'main.js'));
  });

  it('replays the welcome tour', async () => {
    await app().runCommand('help.showTour');
    await app().query(text(/^1 of \d+$/));
    await app().click(role('button', 'Skip tour'));
    await app().waitForAbsent(text(/^1 of \d+$/));
  });
});
