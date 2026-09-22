// The title bar's menu bar on Windows and Linux. FIDDLE_TEST_MENUBAR forces it on
// every platform. At the default width the last titles may be folded into the
// More button, so tests drive File, Edit and View and read the whole list from
// the Window store.
import { beforeAll, describe, expect, it } from 'vitest';

import { role, text, useApp, windowState } from './harness.ts';

describe('menu bar', () => {
  const app = useApp({ env: { FIDDLE_TEST_MENUBAR: '1' } });
  // The titles refold when the toolbar capsule grows with its version label, and a
  // refold closes an open menu, so wait for the version to resolve first.
  beforeAll(async () => {
    await app().query(text('Ready to run', { timeout: 20_000 }));
  });
  const states = async (roleName: string, name: string) =>
    (await app().query(role(roleName, name)))[0]?.states ?? [];
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
  const menuBar = async () => (await windowState(app())).menuBar ?? [];
  const menuLabels = async () =>
    (await menuBar()).flatMap((menu) => (menu.kind === 'submenu' ? [menu.label] : []));
  /** The bar's titles while no menu is open: every menu, or the ones that fit and More. */
  const barTitles = async () =>
    (await app().query(role('menuitem'))).map((item) => item.name);
  /** Opens a menu from its title, or from the More button when it is folded there. */
  const openMenu = async (label: string) => {
    if (!(await barTitles()).includes(label)) await app().click(role('menuitem', 'More'));
    await app().click(role('menuitem', label));
  };

  it('shows every menu in the title bar', async () => {
    await app().query(role('menubar', 'Application menu'));
    // Test builds are unpackaged, so they have the Develop menu too.
    expect(await menuBar()).toMatchObject([
      { kind: 'submenu', id: 'menu:file', label: 'File' },
      { kind: 'submenu', id: 'menu:edit', label: 'Edit' },
      { kind: 'submenu', id: 'menu:view', label: 'View' },
      { kind: 'submenu', id: 'menu:run', label: 'Run' },
      { kind: 'submenu', id: 'menu:window', label: 'Window' },
      { kind: 'submenu', id: 'menu:develop', label: 'Develop' },
      { kind: 'submenu', id: 'menu:help', label: 'Help' },
    ]);
    const labels = await menuLabels();
    // The bar shows them in order; what doesn't fit before the capsule is folded into More.
    const titles = await barTitles();
    if (titles.at(-1) === 'More') {
      expect(titles.length).toBeGreaterThanOrEqual(3);
      expect(titles.slice(0, -1)).toEqual(labels.slice(0, titles.length - 1));
    } else {
      expect(titles).toEqual(labels);
    }
    expect(titles.slice(0, 3)).toEqual(['File', 'Edit', 'View']);
  });

  it('opens a folded menu from the More button, when the window is too narrow for every title', async ({
    skip,
  }) => {
    const titles = await barTitles();
    if (titles.at(-1) !== 'More')
      skip('every title fits at this width, so nothing is folded');
    const folded = (await menuLabels()).slice(titles.length - 1);
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

  it('opens File with its items, keys and disabled entries, and closes it on Escape', async () => {
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

  it('runs what is chosen, with labels that follow the window', async () => {
    await openMenu('View');
    await app().click(role('menuitem', 'Hide sidebar'));
    await app().waitForAbsent(role('menu', 'View'));
    await expect.poll(async () => (await windowState(app())).layout.sidebar).toBe(false);
    await app().waitForAbsent(role('navigation', 'Files'));
    await openMenu('View');
    await app().click(role('menuitem', 'Show sidebar'));
    await expect.poll(async () => (await windowState(app())).layout.sidebar).toBe(true);
    await app().query(role('navigation', 'Files'));
  });

  it('runs role items itself: Zoom in and Actual size', async () => {
    const ratio = async () => Number(await app().evaluate('window.devicePixelRatio'));
    const initial = await ratio();
    await openMenu('View');
    await app().click(role('menuitem', 'Zoom in'));
    await expect.poll(ratio).toBeGreaterThan(initial);
    // The narrower bar may now fold View into More: wait until its titles stop changing.
    let last = '';
    await expect
      .poll(async () => {
        const previous = last;
        last = (await barTitles()).join();
        return last === previous;
      })
      .toBe(true);
    await openMenu('View');
    await app().click(role('menuitem', 'Actual size'));
    await expect.poll(ratio).toBe(initial);
  });

  it('gives editing items back the focus they act on: Select all', async () => {
    await app().click(role('code'));
    await app().click(role('menuitem', 'Edit'));
    await app().click(role('menuitem', 'Select all'));
    await expect.poll(async () => (await focused())?.inEditor).toBe(true);
  });

  it('takes the keyboard on Alt or Alt and a mnemonic, and gives it back on Escape', async () => {
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
    await expect
      .poll(focused)
      .toMatchObject({ role: 'menuitem', name: 'Show welcome tour' });
    // Escape backs out a level at a time (submenu, menu, bar), then gives the editor its focus back.
    for (let level = 0; level < 3 && !(await focused())?.inEditor; level++)
      await app().press('Escape');
    await app().waitForAbsent(role('menu', 'Help'));
    await expect.poll(async () => (await focused())?.inEditor).toBe(true);
  });
});
