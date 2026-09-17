// The title bar's menu bar on Windows and Linux (§17.14). FIDDLE_TEST_MENUBAR
// forces it on every platform, so this runs on a macOS desktop too, where it
// shows the Linux menus. Test builds are unpackaged, so they also have the
// development-only Develop menu before Help. At the default width the last
// titles may be folded into the More button (on macOS the traffic lights take
// room too), so tests drive File, Edit and View, which always fit, and read
// the whole list from the Window store.
import { describe, expect, it } from 'vitest';

import { role, text, useApp, windowState } from './harness.ts';

interface MenuNode {
  kind: string;
  id?: string;
  label?: string;
  children?: MenuNode[];
}

describe('menu bar', () => {
  const app = useApp({ env: { FIDDLE_TEST_MENUBAR: '1' } });
  const states = async (roleName: string, name: string) => (await app().query(role(roleName, name)))[0]?.states ?? [];
  /** What has focus: its role, its accessible label or text, and whether it's in a code editor. */
  const focused = () =>
    app().evaluate(`(() => {
      const element = document.activeElement;
      if (!element) return null;
      const labelledBy = document.getElementById(element.getAttribute('aria-labelledby') ?? '');
      return {
        role: element.getAttribute('role'),
        name: element.getAttribute('aria-label') ?? (labelledBy ?? element).textContent.trim(),
        inEditor: element.closest('.monaco-editor') !== null,
      };
    })()`) as Promise<{ role: string | null; name: string; inEditor: boolean } | null>;

  /** The menus main built for the window, from its store. */
  const menuModel = async () => ((await windowState(app())) as unknown as { menuBar: MenuNode[] }).menuBar;
  /** The bar's titles while no menu is open: every menu, or the ones that fit and More. */
  const barTitles = async () => (await app().query(role('menuitem'))).map((item) => item.name);

  it('shows File, Edit, View, Run, Window and Help in the title bar @feature workspace.menubar', async () => {
    await app().query(role('menubar', 'Application menu'));
    // Main builds it per window and pushes it in the Window store.
    const menuBar = await menuModel();
    expect(menuBar.map((menu) => [menu.kind, menu.id, menu.label])).toEqual([
      ['submenu', 'menu:file', 'File'],
      ['submenu', 'menu:edit', 'Edit'],
      ['submenu', 'menu:view', 'View'],
      ['submenu', 'menu:run', 'Run'],
      ['submenu', 'menu:window', 'Window'],
      ['submenu', 'menu:develop', 'Develop'],
      ['submenu', 'menu:help', 'Help'],
    ]);
    // The bar shows them in order; what doesn't fit before the capsule is folded into More.
    const labels = menuBar.map((menu) => menu.label);
    const titles = await barTitles();
    if (titles.at(-1) === 'More') {
      expect(titles.length).toBeGreaterThanOrEqual(3);
      expect(titles.slice(0, -1)).toEqual(labels.slice(0, titles.length - 1));
    } else {
      expect(titles).toEqual(labels);
    }
    expect(titles.slice(0, 3)).toEqual(['File', 'Edit', 'View']);
  });

  it('opens a folded menu from the More button, when the window is too narrow for every title @feature workspace.menubar', async ({ skip }) => {
    const titles = await barTitles();
    if (titles.at(-1) !== 'More') skip('every title fits at this width, so nothing is folded');
    const folded = (await menuModel()).map((menu) => menu.label ?? '').slice(titles.length - 1);
    expect(folded.length).toBeGreaterThan(0);
    await app().click(role('menuitem', 'More'));
    await app().query(role('menu', 'More'));
    expect(await states('menuitem', 'More')).toContain('expanded');
    for (const label of folded) await app().query(role('menuitem', label));
    // A folded menu is a submenu there: Right opens it on its first item, Escape backs out.
    await app().press('ArrowDown');
    await expect.poll(focused).toMatchObject({ role: 'menuitem', name: folded[0] });
    await app().press('ArrowRight');
    await app().query(role('menu', folded[0]));
    await app().press('Escape');
    await app().waitForAbsent(role('menu', folded[0]));
    await app().press('Escape');
    await app().waitForAbsent(role('menu', 'More'));
    await app().press('Escape');
    expect(await states('menuitem', 'More')).not.toContain('focused');
  });

  it('opens File with its items, keys and disabled entries, and closes it on Escape @feature workspace.menubar', async () => {
    await app().click(role('menuitem', 'File'));
    await app().query(role('menu', 'File'));
    expect(await states('menuitem', 'File')).toContain('expanded');
    await app().query(role('menuitem', 'New fiddle'));
    await app().query(text('Ctrl+N'));
    await app().query(role('menuitem', 'Open recent'));
    await app().query(role('menuitem', 'Settings…'));
    // No gist is loaded, so its history has nothing to show.
    expect(await states('menuitem', 'Show gist history…')).toContain('disabled');
    expect(await states('menuitem', 'Save')).not.toContain('disabled');
    // Escape closes the menu and keeps the bar; a second Escape lets go.
    await app().press('Escape');
    await app().waitForAbsent(role('menu', 'File'));
    expect(await states('menuitem', 'File')).toContain('focused');
    await app().press('Escape');
    expect(await states('menuitem', 'File')).not.toContain('focused');
  });

  it('runs what is chosen, with labels that follow the window @feature workspace.menubar workspace.panels', async () => {
    await app().click(role('menuitem', 'View'));
    await app().click(role('menuitem', 'Hide sidebar'));
    await app().waitForAbsent(role('menu', 'View'));
    await expect.poll(async () => (await windowState(app())).layout.sidebar).toBe(false);
    await app().waitForAbsent(role('navigation', 'Files'));
    await app().click(role('menuitem', 'View'));
    await app().click(role('menuitem', 'Show sidebar'));
    await expect.poll(async () => (await windowState(app())).layout.sidebar).toBe(true);
    await app().query(role('navigation', 'Files'));
  });

  it('runs role items itself: Zoom in and Actual size @feature workspace.menubar keys.zoom', async () => {
    const ratio = async () => Number(await app().evaluate('window.devicePixelRatio'));
    const initial = await ratio();
    await app().click(role('menuitem', 'View'));
    await app().click(role('menuitem', 'Zoom in'));
    await expect.poll(ratio).toBeGreaterThan(initial);
    await app().click(role('menuitem', 'View'));
    await app().click(role('menuitem', 'Actual size'));
    await expect.poll(ratio).toBe(initial);
  });

  it('gives editing items back the focus they act on: Select all, then Copy @feature workspace.menubar keys.clipboard', async () => {
    await app().click(role('code'));
    await app().click(role('menuitem', 'Edit'));
    await app().click(role('menuitem', 'Select all'));
    await expect.poll(async () => (await focused())?.inEditor).toBe(true);
    await app().click(role('menuitem', 'Edit'));
    await app().click(role('menuitem', 'Copy'));
    await expect.poll(() => app().clipboard()).toContain('electron');
  });

  it('takes the keyboard on Alt or Alt and a mnemonic, and gives it back on Escape @feature keys.menubar-alt', async () => {
    await app().click(role('code'));
    await expect.poll(async () => (await focused())?.inEditor).toBe(true);
    await app().press('Alt');
    await expect.poll(focused).toMatchObject({ role: 'menuitem', name: 'File' });
    await app().press('ArrowRight');
    await expect.poll(focused).toMatchObject({ role: 'menuitem', name: 'Edit' });
    await app().press('ArrowDown');
    await app().query(role('menu', 'Edit'));
    await expect.poll(focused).toMatchObject({ role: 'menuitem', name: 'Undo' });
    await app().press('Escape');
    await app().press('Escape');
    await expect.poll(async () => (await focused())?.inEditor).toBe(true);
    // Alt+H opens Help on its first item: in place, or inside More when it's folded there.
    await app().press('Alt+h');
    await app().query(role('menu', 'Help'));
    await expect.poll(focused).toMatchObject({ role: 'menuitem', name: 'Show welcome tour' });
    // Escape backs out a level at a time (submenu, menu, bar), then gives the editor its focus back.
    for (let level = 0; level < 3 && !(await focused())?.inEditor; level++) await app().press('Escape');
    await app().waitForAbsent(role('menu', 'Help'));
    await expect.poll(async () => (await focused())?.inEditor).toBe(true);
  });
});
