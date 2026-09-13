// Smoke specs: the app launches, and every driver capability works end to end.
import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import { role, useApp } from './harness.ts';

describe('smoke', () => {
  const app = useApp();

  it('launches and shows its window', async () => {
    const [win] = await app().windows();
    expect(win).toMatchObject({ index: 0, visible: true });
    expect(win?.url).toBe('app://main/index.html');
  });

  it('shows the title bar controls in the accessibility snapshot', async () => {
    await app().query(role('button', 'Settings'));
    const snapshot = await app().snapshot();
    // The document is named after the fiddle; the title bar is the banner.
    expect(snapshot).toMatch(/^RootWebArea "[^"]+"/);
    expect(snapshot).toMatch(/\n {2}banner\n/);
    expect(snapshot).toContain('button "Run"');
    expect(snapshot).toContain('button "Settings"');
    expect(snapshot).toMatch(/button "(Show|Hide) sidebar"/);
  });

  it('clicks a control with real input', async () => {
    const [sidebarButton] = await app().query(role('button', /^(Show|Hide) sidebar$/));
    const next = sidebarButton?.name === 'Hide sidebar' ? 'Show sidebar' : 'Hide sidebar';
    await app().click(role('button', sidebarButton?.name ?? ''));
    await app().query(role('button', next));
  });

  it('reads the stores', async () => {
    const { app: appStore, window } = await app().stores(0);
    expect(appStore).toMatchObject({ locale: 'en', platform: process.platform });
    expect(window).toMatchObject({ windowId: expect.any(String) });
  });

  it('runs a command by ID', async () => {
    await app().runCommand('app.newWindow');
    const second = await app().waitForWindow(1);
    expect(second.visible).toBe(true);
    expect(await app().windows()).toHaveLength(2);
  });

  it('takes a screenshot', async () => {
    const shot = await app().screenshot(undefined, 0);
    expect(shot.width).toBeGreaterThan(500);
    expect(fs.statSync(shot.path).size).toBeGreaterThan(1000);
  });

  it('answers native dialogs from a script and records OS side effects', async () => {
    await app().queueDialog('messageBox', { response: 0 });
    await app().evaluate(`window.open('https://example.com/docs')`, 0);
    await expect.poll(() => app().sideEffects()).toContainEqual({
      kind: 'shell.openExternal',
      args: ['https://example.com/docs'],
    });
    const [dialog] = await app().dialogs();
    expect(dialog).toMatchObject({ kind: 'messageBox', scripted: true });
  });

  it('settles to idle', async () => {
    const { waitedMs } = await app().waitForIdle();
    expect(waitedMs).toBeLessThan(10_000);
  });
});
