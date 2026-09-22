import { EventEmitter } from 'node:events';

import type { MenuItemConstructorOptions } from 'electron';
import { describe, expect, it, vi } from 'vitest';

import { commandIds, isCommandId, commands, type CommandId } from '../shared/commands';
import { normalizeAccelerator } from '../shared/settings';
import {
  DEFAULT_LAYOUT,
  menuBarSchema,
  type MenuNode,
  type Platform,
  type RunState,
  type WindowLayout,
  type WindowState,
} from '../shared/stores';
import type { CommandRegistry } from './commands';
import type { MenuState } from './menu';
import type { Services } from './services';

const electron = vi.hoisted(() => ({
  app: { isPackaged: false, on: vi.fn() },
  BrowserWindow: {},
  Menu: {
    buildFromTemplate: vi.fn((template: unknown) => template),
    setApplicationMenu: vi.fn(),
  },
}));
vi.mock('electron', () => electron);
// The real English catalogue, for the sentence case check.
vi.mock('./i18n', async () => {
  const { default: main } = await import('../i18n/generated/en/main');
  const messages: Record<string, string> = main;
  return {
    t: (key: string, options?: { name?: string }) =>
      (messages[key] ?? `??${key}`).replace('{{name}}', options?.name ?? ''),
    tm: () => (key: string) => key,
  };
});
vi.mock('./log', () => ({ log: { info: vi.fn(), error: vi.fn() } }));
const recent = vi.hoisted(() => ({ folders: [] as string[] }));
vi.mock('./documents/service', () => ({
  clearRecentFolders: vi.fn(),
  currentTemplateName: () => 'BrowserWindow',
  openFolderIn: vi.fn(() => Promise.resolve()),
  recentFolders: () => recent.folders,
  showMeIn: vi.fn(() => Promise.resolve(1)),
  withErrorDialog: vi.fn(
    (_windowId: string | undefined, action: () => Promise<unknown>) => action(),
  ),
}));
/** Open BrowserWindows by ID, for the title bar menu bar's item activation. */
const openWindows = vi.hoisted(
  () => new Map<string, { id: string; isFullScreen(): boolean }>(),
);
vi.mock('./windows', () => ({
  focusedWindowId: () => undefined,
  getWindow: (windowId?: string) =>
    windowId === undefined ? undefined : openWindows.get(windowId),
  windowIdOf: (window?: { id?: string }) => window?.id,
}));
vi.mock('./test-mode', () => ({ testMenuBar: () => false }));

const { activateWindowMenuItem, buildMenuTemplate, installMenu, toggleWindowMenuBar } =
  await import('./menu');
const { roleAccelerator, toMenuModel } = await import('./menu-model');
const { t } = await import('./i18n');
const { log } = await import('./log');
const documents = await import('./documents/service');

type Item = MenuItemConstructorOptions;
const PLATFORMS: readonly Platform[] = ['darwin', 'win32', 'linux'];
const registry = {
  isEnabled: () => true,
  run: vi.fn(() => Promise.resolve()),
} as unknown as CommandRegistry;

/** Only `layout` and `run` matter to the menu; enablement comes from the registry. */
function windowState(
  patch: { layout?: Partial<WindowLayout>; run?: Partial<RunState> } = {},
): WindowState {
  return {
    layout: { ...DEFAULT_LAYOUT, ...patch.layout },
    run: patch.run,
  } as unknown as WindowState;
}

function build(
  overrides: Partial<MenuState> = {},
  commandRegistry: CommandRegistry = registry,
): Item[] {
  return buildMenuTemplate(commandRegistry, {
    platform: 'darwin',
    focused: '3c8f7a52-9d0e-4c6b-8f4d-2b1a0e9c7d55',
    win: windowState(),
    fullScreen: false,
    keybindings: {},
    dev: false,
    menuBar: false,
    ...overrides,
  });
}

/** A top-level menu's items, by its `menu:<name>` id. */
function menu(template: Item[], name: string): Item[] {
  const found = template.find((item) => item.id === `menu:${name}`);
  if (!found || !Array.isArray(found.submenu)) throw new Error(`no ${name} menu`);
  return found.submenu;
}

const ids = (items: Item[]) => items.map((item) => item.id);
const item = (items: Item[], id: string) =>
  items.find((candidate) => candidate.id === id);

function walk(items: Item[], visit: (item: Item, siblings: Item[]) => void): void {
  for (const each of items) {
    visit(each, items);
    if (Array.isArray(each.submenu)) walk(each.submenu, visit);
  }
}

/** The command items' IDs, anywhere in the template. */
const commandsIn = (template: Item[]) => {
  const found = new Set<string>();
  walk(template, (each) => void (each.id && isCommandId(each.id) && found.add(each.id)));
  return found;
};

describe('application menu', () => {
  it('has the app menu on macOS only, and the Develop menu before Help in development builds only', () => {
    expect(build({ platform: 'darwin' })[0]?.id).toBe('menu:app');
    for (const platform of PLATFORMS) {
      const top = (dev: boolean) => ids(build({ platform, dev }));
      expect(top(false)).not.toContain('menu:develop');
      expect(top(true).slice(-2)).toEqual(['menu:develop', 'menu:help']);
      if (platform !== 'darwin') expect(top(false)).not.toContain('menu:app');

      const release = commandsIn(build({ platform, dev: false }));
      for (const id of ['dev.toggleMenuBar', 'view.reload', 'view.reloadAllWindows'])
        expect(release).not.toContain(id);
    }
  });

  it("checks Develop's toggle while windows draw the title bar menu bar", () => {
    const toggle = (state: Partial<MenuState>) =>
      item(menu(build({ dev: true, ...state }), 'develop'), 'dev.toggleMenuBar');
    expect(toggle({ menuBar: false })).toMatchObject({
      type: 'checkbox',
      checked: false,
    });
    expect(toggle({ menuBar: true })).toMatchObject({ type: 'checkbox', checked: true });
  });

  it('keeps Settings and Quit in the app menu on macOS and in File elsewhere, and About in Help only there', () => {
    const mac = build({ platform: 'darwin' });
    expect(ids(menu(mac, 'app'))).toEqual(
      expect.arrayContaining(['role:about', 'app.preferences', 'role:quit']),
    );
    expect(ids(menu(mac, 'file'))).not.toContain('app.preferences');
    expect(ids(menu(mac, 'file'))).not.toContain('role:quit');
    expect(ids(menu(mac, 'help'))).not.toContain('help.about');

    for (const platform of ['win32', 'linux'] as const) {
      const file = menu(build({ platform }), 'file');
      expect(ids(file)).toContain('app.preferences');
      expect(file.at(-1)).toMatchObject({ id: 'role:quit' });
      expect(menu(build({ platform }), 'help').at(-1)).toMatchObject({
        id: 'help.about',
      });
    }
    // Windows says Exit, the others Quit.
    const quit = (platform: Platform, name: string) =>
      item(menu(build({ platform }), name), 'role:quit')?.label;
    expect(quit('win32', 'file')).toBe(t('exit'));
    expect(quit('linux', 'file')).toBe(t('quit', { name: t('appMenu') }));
  });

  it('lists the open windows in Window, with macOS-only zoom and bring-to-front roles', () => {
    for (const platform of PLATFORMS) {
      const template = build({ platform });
      expect(template.find((each) => each.id === 'menu:window')?.role).toBe('window');
      const windowMenu = ids(menu(template, 'window'));
      expect(windowMenu).toEqual(expect.arrayContaining(['editor.moveTabLeft']));
      // Close window is File's; the Window menu doesn't repeat it.
      expect(windowMenu).not.toContain('role:close');
      const mac = platform === 'darwin';
      expect(windowMenu.includes('role:zoom')).toBe(mac);
      expect(windowMenu.includes('role:front')).toBe(mac);
    }
  });

  it('has one full screen item at the end of View, with no key of its own', () => {
    for (const platform of PLATFORMS) {
      const view = menu(build({ platform }), 'view');
      expect(view.at(-1)).toMatchObject({ id: 'role:togglefullscreen' });
      // The role brings Ctrl+Cmd+F or F11; nothing of ours registers a second key.
      expect(view.at(-1)?.accelerator).toBeUndefined();
    }
  });

  it('says what the stateful items will do', () => {
    const label = (state: Partial<MenuState>, name: string, id: string) =>
      item(menu(build(state), name), id)?.label;
    const bisect = (result: { good: string; bad: string } | null) => ({
      good: '30.0.0',
      bad: '31.0.0',
      auto: true,
      current: result ? null : '30.4.0',
      result,
    });

    expect(label({}, 'view', 'view.toggleSidebar')).toBe(t('hideSidebar'));
    expect(label({}, 'view', 'view.toggleConsole')).toBe(t('hideConsole'));
    expect(label({}, 'view', 'role:togglefullscreen')).toBe(t('enterFullScreen'));
    expect(label({}, 'run', 'run.toggle')).toBe(t('run'));
    expect(label({}, 'run', 'bisect.toggle')).toBe(t(commands['bisect.toggle'].label));

    const active = {
      win: windowState({
        layout: { sidebar: false, consoleVisible: false },
        run: { status: 'running', bisect: bisect(null) },
      }),
      fullScreen: true,
    } satisfies Partial<MenuState>;
    expect(label(active, 'view', 'view.toggleSidebar')).toBe(t('showSidebar'));
    expect(label(active, 'view', 'view.toggleConsole')).toBe(t('showConsole'));
    expect(label(active, 'view', 'role:togglefullscreen')).toBe(t('exitFullScreen'));
    expect(label(active, 'run', 'run.toggle')).toBe(t('stop'));
    expect(label(active, 'run', 'bisect.toggle')).toBe(t('stopBisect'));

    // A finished bisect is nothing to stop.
    const finished = windowState({
      run: { status: 'ready', bisect: bisect({ good: '30.3.0', bad: '30.4.0' }) },
    });
    expect(label({ win: finished }, 'run', 'bisect.toggle')).toBe(
      t(commands['bisect.toggle'].label),
    );

    // No focused window (macOS): the defaults.
    expect(
      label({ focused: undefined, win: undefined }, 'view', 'view.toggleSidebar'),
    ).toBe(t('hideSidebar'));
  });

  it('follows keybinding overrides, drops an unbound key and leaves context-scoped keys to the renderer', () => {
    const template = build({
      keybindings: { 'file.save': 'Ctrl+Alt+S', 'file.saveAs': null },
    });
    const file = menu(template, 'file');
    expect(item(file, 'file.save')?.accelerator).toBe('Ctrl+Alt+S');
    expect(item(file, 'file.saveAs')?.accelerator).toBeUndefined();
    // Clear console's key only applies in the console, so a menu item would fire it everywhere.
    expect(item(menu(template, 'edit'), 'console.clear')?.accelerator).toBeUndefined();
  });

  it('gives the main commands their default key on each platform', () => {
    const expected: [id: CommandId, key: string, macKey?: string][] = [
      ['file.save', 'CmdOrCtrl+S'],
      ['view.reload', 'CmdOrCtrl+Shift+R'],
      ['view.toggleDevTools', 'CmdOrCtrl+Alt+I'],
      ['editor.format', 'Shift+Alt+F'],
      ['editor.moveTabLeft', 'Ctrl+Shift+PageUp', 'Ctrl+Cmd+Left'],
      ['editor.moveTabRight', 'Ctrl+Shift+PageDown', 'Ctrl+Cmd+Right'],
    ];
    for (const platform of PLATFORMS) {
      const template = build({ platform, dev: true });
      for (const [id, key, macKey = key] of expected) {
        let found: Item | undefined;
        walk(template, (each) => void (each.id === id && (found ??= each)));
        expect(found?.accelerator, `${platform}: ${id}`).toBe(
          platform === 'darwin' ? macKey : key,
        );
      }
    }
  });

  it('reaches every command but the editor-only navigation ones from the menu bar', () => {
    const inMenu = (platform: Platform) => commandsIn(build({ platform, dev: true }));
    const contextMenuOnly: CommandId[] = [
      'editor.goToDefinition',
      'editor.findReferences',
    ];
    expect([...inMenu('win32')].sort()).toEqual(
      commandIds.filter((id) => !contextMenuOnly.includes(id)).sort(),
    );
    // On macOS the app menu's About role stands in for help.about.
    expect([...inMenu('darwin')].sort()).toEqual(
      commandIds
        .filter((id) => !contextMenuOnly.includes(id) && id !== 'help.about')
        .sort(),
    );
  });

  it('repeats no label within a menu, registers no key twice, and has no empty groups', () => {
    for (const platform of PLATFORMS) {
      const template = build({ platform, dev: true });
      const keys = new Map<string, string>();
      walk(template, (each, siblings) => {
        if (each.type === 'separator') {
          const index = siblings.indexOf(each);
          expect(
            index > 0 && index < siblings.length - 1,
            `${platform}: separator at the edge of a menu`,
          ).toBe(true);
          expect(
            siblings[index - 1]?.type,
            `${platform}: two separators in a row`,
          ).not.toBe('separator');
          return;
        }
        const accelerator =
          each.accelerator ??
          (each.role ? roleAccelerator(each.role, platform) : undefined);
        if (accelerator) {
          const key = normalizeAccelerator(String(accelerator), platform);
          expect(
            keys.get(key),
            `${platform}: ${key} on both "${keys.get(key)}" and "${each.label}"`,
          ).toBeUndefined();
          keys.set(key, each.label ?? '?');
        }
      });
      walk([{ submenu: template }], (each) => {
        if (!Array.isArray(each.submenu)) return;
        const shown = each.submenu
          .filter((child) => child.type !== 'separator')
          .map((child) => child.label);
        expect(
          new Set(shown).size,
          `${platform}: duplicate label in ${each.label ?? 'the menu bar'}: ${shown.join(', ')}`,
        ).toBe(shown.length);
      });
    }
  });

  it('uses sentence case, and an ellipsis only at the end of a label', () => {
    const properNouns = new Set(['Electron', 'Fiddle', 'GitHub', 'Forge', 'Tab']);
    for (const platform of PLATFORMS) {
      walk(build({ platform, dev: true }), (each, siblings) => {
        const label = each.label;
        if (
          each.type === 'separator' ||
          !label ||
          siblings.some((sibling) => sibling.type === 'radio')
        )
          return;
        expect(label, 'three dots instead of an ellipsis').not.toContain('...');
        expect(
          label.indexOf('…') === -1 || label.indexOf('…') === label.length - 1,
          `${label}: ellipsis mid-label`,
        ).toBe(true);
        const capitalized = label
          .split(' ')
          .slice(1)
          .filter((word) => /^[A-Z]/.test(word) && !properNouns.has(word));
        expect(capitalized, `${label}: title case`).toEqual([]);
      });
    }
  });
});

describe('command items', () => {
  it('are disabled when the registry says so, asking about the focused window', () => {
    const isEnabled = vi.fn((id: string) => id !== 'file.save');
    const template = build({ focused: 'w' }, {
      isEnabled,
      run: vi.fn(),
    } as unknown as CommandRegistry);
    const file = menu(template, 'file');
    expect(item(file, 'file.save')).toMatchObject({ enabled: false });
    expect(item(file, 'file.saveAs')).toMatchObject({ enabled: true });
    expect(isEnabled).toHaveBeenCalledWith('file.save', 'w');
  });

  it('run in the window the click came from, else the focused one, and log a failure', async () => {
    const run = vi.fn(() => Promise.resolve());
    const template = build({ focused: 'focused' }, {
      isEnabled: () => true,
      run,
    } as unknown as CommandRegistry);
    const save = item(menu(template, 'file'), 'file.save')!;
    const click = (window?: { id: string }) =>
      save.click?.(
        {} as Electron.MenuItem,
        window as never,
        {} as Electron.KeyboardEvent,
      );

    click({ id: 'clicked' });
    expect(run).toHaveBeenLastCalledWith('file.save', { windowId: 'clicked' });
    click();
    expect(run).toHaveBeenLastCalledWith('file.save', { windowId: 'focused' });

    run.mockRejectedValueOnce(new Error('boom'));
    click();
    await vi.waitFor(() => expect(log.error).toHaveBeenCalled());
  });

  it('open a recent folder and an example in the window the click came from', () => {
    recent.folders = ['/tmp/f1'];
    try {
      const template = build({ platform: 'linux', focused: 'focused' });
      const click = (id: string) => {
        let found: Item | undefined;
        walk(template, (candidate) => void (candidate.id === id && (found = candidate)));
        if (!found) throw new Error(`no ${id}`);
        found.click?.(
          {} as Electron.MenuItem,
          { id: 'clicked' } as never,
          {} as Electron.KeyboardEvent,
        );
      };
      click('recent:0');
      expect(documents.openFolderIn).toHaveBeenCalledWith('clicked', '/tmp/f1');
      click('example:Menu');
      expect(documents.showMeIn).toHaveBeenCalledWith('clicked', 'Menu');
      click('recent:clear');
      expect(documents.clearRecentFolders).toHaveBeenCalledOnce();
    } finally {
      recent.folders = [];
    }
  });
});

describe('menu bar model', () => {
  /** Every non-separator node, depth first. */
  const nodes = (model: MenuNode[]): Exclude<MenuNode, { kind: 'separator' }>[] =>
    model.flatMap((node) =>
      node.kind === 'separator'
        ? []
        : node.kind === 'submenu'
          ? [node, ...nodes(node.children)]
          : [node],
    );
  const find = (model: MenuNode[], id: string) =>
    nodes(model).find((node) => node.id === id);

  it('gives every item a stable, unique id, and is a valid store value', () => {
    for (const platform of PLATFORMS) {
      const template = build({ platform, dev: true });
      const all: string[] = [];
      walk(template, (each) => {
        if (each.type === 'separator') return;
        expect(each.id, `${platform}: "${each.label}" has no id`).toBeTruthy();
        all.push(each.id!);
      });
      expect(new Set(all).size, `${platform}: duplicate ids in ${all.join(', ')}`).toBe(
        all.length,
      );
      const model = toMenuModel(template, platform);
      expect(menuBarSchema.safeParse(model).success).toBe(true);
      expect(nodes(model).map((node) => node.id)).toEqual(all);
    }
  });

  it('carries enablement, the checked example and the recent folders', () => {
    recent.folders = ['/home/me/fiddles/one', '/home/me/fiddles/two'];
    try {
      const model = toMenuModel(
        build({ platform: 'linux', focused: 'w' }, {
          isEnabled: (id: string) => id !== 'file.save',
          run: vi.fn(),
        } as unknown as CommandRegistry),
        'linux',
      );
      expect(find(model, 'file.save')).toMatchObject({ enabled: false });
      expect(find(model, 'file.saveAs')).toMatchObject({ enabled: true });
      const showMe = find(model, 'menu:showMe');
      expect(
        showMe?.kind === 'submenu' &&
          showMe.children.find((node) => node.kind === 'item' && node.checked),
      ).toMatchObject({ id: 'example:BrowserWindow', checked: true });
      const openRecent = find(model, 'menu:openRecent');
      expect(
        openRecent?.kind === 'submenu' &&
          nodes(openRecent.children).map((node) => [node.id, node.label]),
      ).toEqual([
        ['recent:0', '/home/me/fiddles/one'],
        ['recent:1', '/home/me/fiddles/two'],
        ['recent:clear', 'clearRecent'],
      ]);
    } finally {
      recent.folders = [];
    }
    const empty = find(
      toMenuModel(build({ platform: 'win32' }), 'win32'),
      'menu:openRecent',
    );
    expect(empty?.kind === 'submenu' && empty.children).toEqual([
      { kind: 'item', id: 'recent:none', label: 'noRecent', enabled: false },
    ]);
  });
});

describe('title bar menu bar toggle', () => {
  /** The StateHub as installMenu uses it: a dev build with these windows registered. */
  function fakeHub(windowIds: string[]) {
    return {
      app: { dev: true, settings: { keybindings: {} } },
      windowIds,
      getWindow: (windowId: string) =>
        windowIds.includes(windowId) ? windowState() : undefined,
      updateWindow: vi.fn<(windowId: string, patch: { menuBar?: MenuNode[] }) => number>(
        () => 1,
      ),
      onChange: vi.fn(),
    };
  }
  /** installMenu rebuilds on the next turn of the event loop. */
  const rebuilt = () => new Promise<void>((resolve) => setImmediate(resolve));
  /** Develop's toggle item in the native menu set last. */
  const nativeToggle = () => {
    const template = electron.Menu.setApplicationMenu.mock.calls.at(-1)?.[0] as Item[];
    return item(menu(template, 'develop'), 'dev.toggleMenuBar');
  };
  const topLevel = (model: MenuNode[]) =>
    model.map((node) => (node.kind === 'submenu' ? node.id : node.kind));
  const barMenus = [
    'menu:file',
    'menu:edit',
    'menu:view',
    'menu:run',
    'menu:window',
    'menu:develop',
    'menu:help',
  ];

  it('shows the bar in every window on macOS, with the Linux menus, then takes it away again', async () => {
    const hub = fakeHub(['w1', 'w2']);
    installMenu({ registry, hub, platform: 'darwin' } as unknown as Services);
    await rebuilt();
    // macOS has the OS menu bar: nothing is pushed, and the toggle is unchecked.
    expect(hub.updateWindow).not.toHaveBeenCalled();
    expect(nativeToggle()).toMatchObject({ type: 'checkbox', checked: false });

    expect(toggleWindowMenuBar()).toBe(true);
    await rebuilt();
    expect(hub.updateWindow.mock.calls.map(([windowId]) => windowId)).toEqual([
      'w1',
      'w2',
    ]);
    const pushed = hub.updateWindow.mock.calls[0]![1].menuBar!;
    expect(menuBarSchema.safeParse(pushed).success).toBe(true);
    // Linux menus: Quit is in File, with Ctrl+Q written the Linux way.
    expect(topLevel(pushed)).toEqual(barMenus);
    const file = pushed[0]?.kind === 'submenu' ? pushed[0].children : [];
    expect(file.at(-1)).toMatchObject({ id: 'role:quit', accelerator: 'Ctrl+Q' });
    // The toggle is checked now, in the pushed bar and in the native menu.
    const develop = pushed.find(
      (node) => node.kind === 'submenu' && node.id === 'menu:develop',
    );
    expect(develop?.kind === 'submenu' && develop.children[0]).toMatchObject({
      id: 'dev.toggleMenuBar',
      checked: true,
    });
    expect(nativeToggle()).toMatchObject({ checked: true });

    expect(toggleWindowMenuBar()).toBe(false);
    await rebuilt();
    // Off: an absent `menuBar`, which the title bar draws as no bar.
    expect(hub.updateWindow.mock.calls.slice(2)).toEqual([
      ['w1', { menuBar: undefined }],
      ['w2', { menuBar: undefined }],
    ]);
    expect(nativeToggle()).toMatchObject({ checked: false });
  });

  it("chooses an item in a window's title bar menu as the native menu would", async () => {
    const hub = fakeHub(['w']);
    installMenu({ registry, hub, platform: 'linux' } as unknown as Services);
    await rebuilt();
    const unavailable = expect.objectContaining({ code: 'unavailable' });
    // No bar was built for this window.
    expect(() => activateWindowMenuItem('other', 'run.toggle')).toThrow(unavailable);
    // A bar, but the window has closed.
    expect(() => activateWindowMenuItem('w', 'run.toggle')).toThrow(unavailable);

    openWindows.set('w', { id: 'w', isFullScreen: () => false });
    try {
      vi.mocked(registry.run).mockClear();
      activateWindowMenuItem('w', 'run.toggle');
      expect(registry.run).toHaveBeenCalledWith('run.toggle', { windowId: 'w' });
      // A closed window's bar goes with it, on the store change that unregisters it.
      hub.windowIds.length = 0;
      hub.updateWindow.mockClear();
      const onStoreChange = hub.onChange.mock.calls[0]![0] as () => void;
      onStoreChange();
      await rebuilt();
      expect(hub.updateWindow).not.toHaveBeenCalled();
      expect(() => activateWindowMenuItem('w', 'run.toggle')).toThrow(unavailable);
    } finally {
      openWindows.clear();
    }
  });

  it('rebuilds when a window is created, and again when it enters or leaves full screen', async () => {
    const hub = fakeHub(['w']);
    installMenu({ registry, hub, platform: 'linux' } as unknown as Services);
    await rebuilt();
    const onCreated = electron.app.on.mock.calls
      .filter(([name]) => name === 'browser-window-created')
      .at(-1)![1] as (event: unknown, win: unknown) => void;
    const win = new EventEmitter();
    hub.windowIds.push('w2');
    onCreated({}, win);
    await rebuilt();
    expect(hub.updateWindow.mock.calls.map(([windowId]) => windowId)).toContain('w2');

    // Full screen changes View's last item in that window's bar.
    hub.updateWindow.mockClear();
    openWindows.set('w', { id: 'w', isFullScreen: () => true });
    try {
      win.emit('enter-full-screen');
      await rebuilt();
      expect(hub.updateWindow.mock.calls.map(([windowId]) => windowId)).toEqual(['w']);
    } finally {
      openWindows.clear();
    }
  });

  it('starts with the bar on Windows and Linux, where the toggle hides it', async () => {
    for (const platform of ['win32', 'linux'] as const) {
      const hub = fakeHub(['w']);
      installMenu({ registry, hub, platform } as unknown as Services);
      await rebuilt();
      expect(hub.updateWindow).toHaveBeenCalledTimes(1);
      expect(topLevel(hub.updateWindow.mock.calls[0]![1].menuBar!)).toEqual(barMenus);
      expect(nativeToggle()).toMatchObject({ checked: true });
      expect(toggleWindowMenuBar()).toBe(false);
      await rebuilt();
      expect(hub.updateWindow.mock.calls.at(-1)).toEqual(['w', { menuBar: undefined }]);
      // A window closed meanwhile is left alone.
      expect(toggleWindowMenuBar()).toBe(true);
      hub.windowIds.length = 0;
      await rebuilt();
      expect(hub.updateWindow).toHaveBeenCalledTimes(2);
    }
  });
});
