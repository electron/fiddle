import type { MenuItemConstructorOptions } from 'electron';
import { describe, expect, it, vi } from 'vitest';

import { commandIds, isCommandId, type CommandId } from '../shared/commands';
import { normalizeAccelerator } from '../shared/settings';
import { DEFAULT_LAYOUT, menuBarSchema, type MenuNode, type Platform, type RunState, type WindowLayout, type WindowState } from '../shared/stores';
import type { CommandRegistry } from './commands';
import type { MenuState } from './menu';
import type { Services } from './services';

const electron = vi.hoisted(() => ({
  app: { isPackaged: false, on: vi.fn() },
  BrowserWindow: {},
  Menu: { buildFromTemplate: vi.fn((template: unknown) => template), setApplicationMenu: vi.fn() },
}));
vi.mock('electron', () => electron);
// Real English labels, so the checks below read like the menu does.
vi.mock('./i18n', async () => {
  const { default: main } = await import('../i18n/generated/en/main');
  const messages: Record<string, string> = main;
  return {
    t: (key: string, options?: { name?: string }) => (messages[key] ?? `??${key}`).replace('{{name}}', options?.name ?? ''),
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
  withErrorDialog: vi.fn((_windowId: string | undefined, action: () => Promise<unknown>) => action()),
}));
vi.mock('./windows', () => ({ focusedWindowId: () => undefined, getWindow: () => undefined, windowIdOf: () => undefined }));
vi.mock('./test-mode', () => ({ testMenuBar: () => false }));

const { buildMenuTemplate, installMenu, toggleWindowMenuBar } = await import('./menu');
const { toMenuModel } = await import('./menu-model');
const documents = await import('./documents/service');

type Item = MenuItemConstructorOptions;
const PLATFORMS: readonly Platform[] = ['darwin', 'win32', 'linux'];
const registry = { isEnabled: () => true, run: vi.fn(() => Promise.resolve()) } as unknown as CommandRegistry;

/** Only `layout` and `run` matter to the menu; enablement comes from the registry. */
function windowState(patch: { layout?: Partial<WindowLayout>; run?: Partial<RunState> } = {}): WindowState {
  return { layout: { ...DEFAULT_LAYOUT, ...patch.layout }, run: patch.run } as unknown as WindowState;
}

function build(overrides: Partial<MenuState> = {}): Item[] {
  return buildMenuTemplate(registry, {
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

/** A top-level menu's items, by its English title. */
function menu(template: Item[], title: string): Item[] {
  const found = template.find((item) => item.label === title);
  if (!found || !Array.isArray(found.submenu)) throw new Error(`no ${title} menu`);
  return found.submenu;
}

/** Command IDs, `(role)`s, submenu titles and `---` separators, in order. */
const outline = (items: Item[]) =>
  items.map((item) => {
    if (item.type === 'separator') return '---';
    if (item.id && isCommandId(item.id)) return item.id;
    return item.role ? `(${item.role})` : item.label;
  });

/** The command items' IDs, anywhere in the template. */
const commandsIn = (template: Item[]) => {
  const ids = new Set<string>();
  walk(template, (item) => void (item.id && isCommandId(item.id) && ids.add(item.id)));
  return ids;
};

const labels = (items: Item[]) => items.filter((item) => item.type !== 'separator').map((item) => item.label);

function walk(items: Item[], visit: (item: Item, siblings: Item[]) => void): void {
  for (const item of items) {
    visit(item, items);
    if (Array.isArray(item.submenu)) walk(item.submenu, visit);
  }
}

/** The key Electron gives a role item that has no explicit accelerator (lib/browser/api/menu-item-roles.ts). */
function roleAccelerator(role: string, platform: Platform): string | undefined {
  switch (role) {
    case 'hide':
      return 'Command+H';
    case 'hideOthers':
      return 'Command+Alt+H';
    case 'quit':
      return platform === 'win32' ? undefined : 'CommandOrControl+Q';
    case 'cut':
      return 'CommandOrControl+X';
    case 'copy':
      return 'CommandOrControl+C';
    case 'paste':
      return 'CommandOrControl+V';
    case 'minimize':
      return 'CommandOrControl+M';
    case 'togglefullscreen':
      return platform === 'darwin' ? 'Control+Command+F' : 'F11';
    default:
      return undefined;
  }
}

describe('application menu', () => {
  it('has the app menu on macOS only, and the same six menus everywhere', () => {
    expect(build({ platform: 'darwin' }).map((item) => item.label)).toEqual([
      'Electron Fiddle',
      'File',
      'Edit',
      'View',
      'Run',
      'Window',
      'Help',
    ]);
    for (const platform of ['win32', 'linux'] as const) {
      expect(build({ platform }).map((item) => item.label)).toEqual(['File', 'Edit', 'View', 'Run', 'Window', 'Help']);
    }
    const appMenu = menu(build({ platform: 'darwin' }), 'Electron Fiddle');
    expect(outline(appMenu)).toEqual([
      '(about)',
      '---',
      'app.preferences',
      '---',
      '(services)',
      '---',
      '(hide)',
      '(hideOthers)',
      '(unhide)',
      '---',
      '(quit)',
    ]);
    expect(appMenu.at(-1)?.label).toBe('Quit Electron Fiddle');
  });

  it('repeats no label within a menu, registers no key twice, and has no empty groups', () => {
    for (const platform of PLATFORMS) {
      const template = build({ platform, dev: true });
      const keys = new Map<string, string>();
      walk(template, (item, siblings) => {
        if (item.type === 'separator') {
          const index = siblings.indexOf(item);
          expect(index > 0 && index < siblings.length - 1, `${platform}: separator at the edge of a menu`).toBe(true);
          expect(siblings[index - 1]?.type, `${platform}: two separators in a row`).not.toBe('separator');
          return;
        }
        const accelerator = item.accelerator ?? (item.role ? roleAccelerator(item.role, platform) : undefined);
        if (accelerator) {
          const key = normalizeAccelerator(String(accelerator), platform);
          expect(keys.get(key), `${platform}: ${key} on both "${keys.get(key)}" and "${item.label}"`).toBeUndefined();
          keys.set(key, item.label ?? '?');
        }
      });
      walk([{ submenu: template }], (item) => {
        if (!Array.isArray(item.submenu)) return;
        const shown = labels(item.submenu);
        expect(new Set(shown).size, `${platform}: duplicate label in ${item.label ?? 'the menu bar'}: ${shown.join(', ')}`).toBe(shown.length);
      });
    }
  });

  // @feature keys.fullscreen keys.zoom keys.menu-editor
  it('lays View out as palette, layout, editor, zoom, then one full screen item', () => {
    const view = menu(build({ platform: 'darwin' }), 'View');
    expect(outline(view)).toEqual([
      'app.commandPalette',
      '---',
      'view.toggleSidebar',
      'view.toggleConsole',
      'view.toggleSplit',
      '---',
      'editor.toggleSoftWrap',
      'editor.toggleMinimap',
      'editor.toggleTabFocus',
      '---',
      '(resetZoom)',
      '(zoomIn)',
      '(zoomOut)',
      '---',
      '(togglefullscreen)',
    ]);
    expect(labels(view)).toEqual([
      'Command palette…',
      'Hide sidebar',
      'Hide console',
      'Split editor',
      'Toggle soft wrap',
      'Toggle minimap',
      'Use Tab to move focus',
      'Actual size',
      'Zoom in',
      'Zoom out',
      'Enter full screen',
    ]);
    // The role brings Ctrl+Cmd+F or F11; nothing of ours registers a second full screen key.
    expect(view.find((item) => item.role === 'togglefullscreen')?.accelerator).toBeUndefined();
    for (const platform of PLATFORMS) expect(outline(menu(build({ platform }), 'View'))).toEqual(outline(view));
  });

  // @feature keys.reload editor.font
  it('adds a Develop menu before Help in development builds only, with the menu bar toggle and the reloads', () => {
    expect(build({ platform: 'darwin', dev: true }).map((item) => item.label)).toEqual([
      'Electron Fiddle',
      'File',
      'Edit',
      'View',
      'Run',
      'Window',
      'Develop',
      'Help',
    ]);
    expect(build({ platform: 'win32', dev: true }).map((item) => item.label)).toEqual(['File', 'Edit', 'View', 'Run', 'Window', 'Develop', 'Help']);
    for (const platform of PLATFORMS) {
      const develop = menu(build({ platform, dev: true }), 'Develop');
      expect(outline(develop)).toEqual(['dev.toggleMenuBar', '---', 'view.reload', 'view.reloadAllWindows']);
      expect(labels(develop)).toEqual(['Toggle title bar menu bar', 'Reload', 'Reload all windows']);
      expect(develop.find((item) => item.id === 'view.reload')?.accelerator).toBe('CmdOrCtrl+Shift+R');
      // View ends with the full screen item in every build now.
      expect(outline(menu(build({ platform, dev: true }), 'View')).at(-1)).toBe('(togglefullscreen)');
      // Packaged builds have no Develop menu at all.
      expect(build({ platform, dev: false }).map((item) => item.label)).not.toContain('Develop');
      const release = [...commandsIn(build({ platform, dev: false }))];
      expect(release).not.toContain('dev.toggleMenuBar');
      expect(release).not.toContain('view.reload');
      expect(release).not.toContain('view.reloadAllWindows');
    }
    // The reload keys still work in release builds: the commands stay defined, and the renderer dispatches every keybinding.
    expect(commandIds).toContain('view.reload');
  });

  // @feature workspace.menubar
  it("checks Develop's toggle while windows draw the title bar menu bar", () => {
    const toggle = (state: Partial<MenuState>) => menu(build({ dev: true, ...state }), 'Develop').find((item) => item.id === 'dev.toggleMenuBar');
    expect(toggle({ menuBar: false })).toMatchObject({ type: 'checkbox', checked: false, enabled: true });
    expect(toggle({ menuBar: true })).toMatchObject({ type: 'checkbox', checked: true });
    // A dev tool: no key of its own.
    expect(toggle({ platform: 'win32', menuBar: true })?.accelerator).toBeUndefined();
  });

  // @feature keys.devtools keys.menu-help
  it('ends Help with Toggle developer tools, then About where there is no app menu', () => {
    expect(outline(menu(build({ platform: 'darwin' }), 'Help'))).toEqual([
      'help.showTour',
      '---',
      'help.fiddleRepository',
      'help.electronRepository',
      'help.reportIssue',
      '---',
      'help.openLogsFolder',
      'help.copyDiagnostics',
      '---',
      'view.toggleDevTools',
    ]);
    expect(outline(menu(build({ platform: 'win32' }), 'Help')).slice(-3)).toEqual(['view.toggleDevTools', '---', 'help.about']);
    expect(build({ platform: 'linux' }).find((item) => item.label === 'Help')?.role).toBe('help');
    expect(menu(build(), 'Help').find((item) => item.id === 'view.toggleDevTools')?.accelerator).toBe('CmdOrCtrl+Alt+I');
  });

  // @feature keys.open-gist keys.preferences keys.menu-file
  it('keeps Open gist with the Open items, and Settings and Exit in File off macOS', () => {
    expect(outline(menu(build({ platform: 'darwin' }), 'File'))).toEqual([
      'file.newFiddle',
      'file.newTest',
      'app.newWindow',
      '---',
      'file.open',
      'Open recent',
      'gist.open',
      '---',
      'file.save',
      'file.saveAs',
      'file.saveAsForge',
      '---',
      'gist.publish',
      'gist.history',
      '---',
      'Show me',
      '---',
      'file.close',
    ]);
    const file = menu(build({ platform: 'win32' }), 'File');
    expect(outline(file).slice(-7)).toEqual(['Show me', '---', 'app.preferences', '---', 'file.close', '---', '(quit)']);
    expect(file.at(-1)?.label).toBe('Exit');
    expect(menu(build({ platform: 'linux' }), 'File').at(-1)?.label).toBe('Quit Electron Fiddle');
    expect(file.find((item) => item.id === 'file.close')?.label).toBe('Close window');
    // Show me checks the focused window's example.
    const showMe = file.find((item) => item.label === 'Show me')?.submenu as Item[];
    expect(showMe.filter((item) => item.checked).map((item) => item.label)).toEqual(['BrowserWindow']);
  });

  // @feature editor.format console.clear keys.edit keys.clipboard
  it('has the format commands and Clear console in Edit, after the clipboard group', () => {
    const edit = menu(build({ platform: 'linux' }), 'Edit');
    expect(outline(edit)).toEqual([
      'edit.undo',
      'edit.redo',
      '---',
      '(cut)',
      '(copy)',
      '(paste)',
      'edit.selectAll',
      '---',
      'editor.format',
      'editor.formatSelection',
      'editor.formatAll',
      '---',
      'console.clear',
    ]);
    expect(edit.find((item) => item.id === 'editor.format')?.accelerator).toBe('Shift+Alt+F');
    // Clear console's CmdOrCtrl+K only applies in the console, so the menu never registers it.
    expect(edit.find((item) => item.id === 'console.clear')?.accelerator).toBeUndefined();
  });

  // @feature keys.move-tab keys.minimize-close
  it('keeps the tab commands in the Window menu, with arrow keys on macOS and Page keys elsewhere', () => {
    const mac = build({ platform: 'darwin' });
    expect(mac.find((item) => item.label === 'Window')?.role).toBe('window');
    expect(outline(menu(mac, 'Window'))).toEqual([
      '(minimize)',
      '(zoom)',
      '---',
      'editor.moveTabLeft',
      'editor.moveTabRight',
      '---',
      '(front)',
    ]);
    const keysIn = (template: Item[]) =>
      menu(template, 'Window')
        .filter((item) => item.id?.startsWith('editor.moveTab'))
        .map((item) => item.accelerator);
    expect(keysIn(mac)).toEqual(['Ctrl+Cmd+Left', 'Ctrl+Cmd+Right']);
    const windows = build({ platform: 'win32' });
    expect(outline(menu(windows, 'Window'))).toEqual(['(minimize)', '---', 'editor.moveTabLeft', 'editor.moveTabRight']);
    expect(keysIn(windows)).toEqual(['Ctrl+Shift+PageUp', 'Ctrl+Shift+PageDown']);
    // Close window is File's (CmdOrCtrl+W); the Window menu doesn't repeat it.
    for (const platform of PLATFORMS) expect(menu(build({ platform }), 'Window').some((item) => item.role === 'close')).toBe(false);
  });

  // @feature run.single keys.bisect
  it('says what the stateful items will do', () => {
    const idle = build();
    expect(labels(menu(idle, 'Run'))).toEqual(['Run', 'Bisect…', 'Package', 'Make installers']);
    const active = build({
      win: windowState({
        layout: { sidebar: false, consoleVisible: false },
        run: { status: 'running', bisect: { good: '30.0.0', bad: '31.0.0', auto: true, current: '30.4.0', result: null } },
      }),
      fullScreen: true,
    });
    expect(labels(menu(active, 'Run'))).toEqual(['Stop', 'Stop bisect', 'Package', 'Make installers']);
    expect(labels(menu(active, 'View')).slice(1, 3)).toEqual(['Show sidebar', 'Show console']);
    expect(menu(active, 'View').at(-1)?.label).toBe('Exit full screen');
    // A finished bisect is nothing to stop.
    const finished = build({
      win: windowState({ run: { status: 'ready', bisect: { good: '30.0.0', bad: '31.0.0', auto: true, current: null, result: { good: '30.3.0', bad: '30.4.0' } } } }),
    });
    expect(labels(menu(finished, 'Run')).slice(0, 2)).toEqual(['Run', 'Bisect…']);
    // No focused window (macOS): the defaults, disabled by the registry.
    expect(labels(menu(build({ focused: undefined, win: undefined }), 'View')).slice(1, 3)).toEqual(['Hide sidebar', 'Hide console']);
  });

  it('follows keybinding overrides, and drops an unbound key', () => {
    const file = menu(build({ keybindings: { 'file.save': 'Ctrl+Alt+S', 'file.saveAs': null } }), 'File');
    expect(file.find((item) => item.id === 'file.save')?.accelerator).toBe('Ctrl+Alt+S');
    expect(file.find((item) => item.id === 'file.saveAs')?.accelerator).toBeUndefined();
  });

  it('reaches every command but the editor-only navigation ones from the menu bar', () => {
    const inMenu = (platform: Platform) => commandsIn(build({ platform, dev: true }));
    const contextMenuOnly: CommandId[] = ['editor.goToDefinition', 'editor.findReferences'];
    expect([...inMenu('win32')].sort()).toEqual(commandIds.filter((id) => !contextMenuOnly.includes(id)).sort());
    // On macOS the app menu's About role stands in for help.about.
    expect([...inMenu('darwin')].sort()).toEqual(
      commandIds.filter((id) => !contextMenuOnly.includes(id) && id !== 'help.about').sort(),
    );
  });

  it('uses sentence case, and an ellipsis only at the end of items that ask for more', () => {
    const properNouns = new Set(['Electron', 'Fiddle', 'GitHub', 'Forge', 'Tab']);
    for (const platform of PLATFORMS) {
      walk(build({ platform, dev: true }), (item, siblings) => {
        const label = item.label;
        if (item.type === 'separator' || !label || siblings.some((sibling) => sibling.type === 'radio')) return;
        expect(label, 'three dots instead of an ellipsis').not.toContain('...');
        expect(label.indexOf('…') === -1 || label.indexOf('…') === label.length - 1, `${label}: ellipsis mid-label`).toBe(true);
        const capitalized = label
          .split(' ')
          .slice(1)
          .filter((word) => /^[A-Z]/.test(word) && !properNouns.has(word));
        expect(capitalized, `${label}: title case`).toEqual([]);
      });
    }
    // Dialog-opening items end in an ellipsis; plain actions and toggles don't.
    const file = labels(menu(build(), 'File'));
    expect(file).toEqual(expect.arrayContaining(['Open…', 'Open gist…', 'Save as…', 'Save as Forge project…', 'Publish to gist…']));
    expect(file).toEqual(expect.arrayContaining(['New fiddle', 'Save', 'Close window']));
  });
});

// The title bar's menu bar on Windows and Linux (`Window.menuBar`, ./menu-model.ts).
// @feature workspace.menubar
describe('menu bar model', () => {
  /** Every non-separator node, depth first. */
  const nodes = (model: MenuNode[]): Exclude<MenuNode, { kind: 'separator' }>[] =>
    model.flatMap((node) => (node.kind === 'separator' ? [] : node.kind === 'submenu' ? [node, ...nodes(node.children)] : [node]));
  const find = (model: MenuNode[], id: string) => nodes(model).find((node) => node.id === id);

  it('gives every item a stable, unique id, and is a valid store value', () => {
    for (const platform of PLATFORMS) {
      const template = build({ platform, dev: true });
      const ids: string[] = [];
      walk(template, (item) => {
        if (item.type === 'separator') return;
        expect(item.id, `${platform}: "${item.label}" has no id`).toBeTruthy();
        ids.push(item.id!);
      });
      expect(new Set(ids).size, `${platform}: duplicate ids in ${ids.join(', ')}`).toBe(ids.length);
      const model = toMenuModel(template, platform);
      expect(menuBarSchema.safeParse(model).success).toBe(true);
      // Every command and role of the native template is in the model, under the same id.
      expect(nodes(model).map((node) => node.id)).toEqual(ids);
    }
  });

  it('lists File, Edit, View, Run, Window and Help as submenus, with formatted accelerators', () => {
    const model = toMenuModel(build({ platform: 'win32' }), 'win32');
    expect(model.map((node) => (node.kind === 'submenu' ? [node.id, node.label] : node.kind))).toEqual([
      ['menu:file', 'File'],
      ['menu:edit', 'Edit'],
      ['menu:view', 'View'],
      ['menu:run', 'Run'],
      ['menu:window', 'Window'],
      ['menu:help', 'Help'],
    ]);
    expect(find(model, 'file.newFiddle')).toEqual({ kind: 'item', id: 'file.newFiddle', label: 'New fiddle', enabled: true, accelerator: 'Ctrl+N' });
    expect(find(model, 'app.commandPalette')).toMatchObject({ accelerator: 'Ctrl+Shift+P' });
    expect(find(model, 'view.toggleSplit')).toMatchObject({ accelerator: 'Ctrl+\\' });
    expect(find(model, 'editor.moveTabLeft')).toMatchObject({ accelerator: 'Ctrl+Shift+PageUp' });
    expect(find(model, 'editor.format')).toMatchObject({ accelerator: 'Shift+Alt+F' });
    // Role items show the key Electron gives the role; Exit has none on Windows, Quit has Ctrl+Q on Linux.
    expect(find(model, 'role:cut')).toMatchObject({ label: 'Cut', accelerator: 'Ctrl+X' });
    expect(find(model, 'role:togglefullscreen')).toMatchObject({ accelerator: 'F11' });
    expect(find(model, 'role:zoomIn')).toMatchObject({ accelerator: 'Ctrl++' });
    expect(find(model, 'role:quit')).toEqual({ kind: 'item', id: 'role:quit', label: 'Exit', enabled: true });
    expect(find(toMenuModel(build({ platform: 'linux' }), 'linux'), 'role:quit')).toMatchObject({ label: 'Quit Electron Fiddle', accelerator: 'Ctrl+Q' });
    expect(find(toMenuModel(build({ platform: 'darwin' }), 'darwin'), 'file.save')).toMatchObject({ accelerator: '⌘S' });
    // A context-scoped key isn't the menu's, so the model shows none either.
    expect(find(model, 'console.clear')).not.toHaveProperty('accelerator');
  });

  it('carries enablement, checked examples and the recent folders', () => {
    recent.folders = ['/home/me/fiddles/one', '/home/me/fiddles/two'];
    try {
      const disabled = { isEnabled: (id: string) => id !== 'file.save', run: vi.fn(() => Promise.resolve()) } as unknown as CommandRegistry;
      const template = buildMenuTemplate(disabled, {
        platform: 'linux',
        focused: 'w',
        win: windowState(),
        fullScreen: false,
        keybindings: {},
        dev: false,
        menuBar: true,
      });
      const model = toMenuModel(template, 'linux');
      expect(find(model, 'file.save')).toMatchObject({ enabled: false });
      expect(find(model, 'file.saveAs')).toMatchObject({ enabled: true });
      const showMe = find(model, 'menu:showMe');
      expect(showMe?.kind === 'submenu' && showMe.children.find((node) => node.kind === 'item' && node.checked)).toMatchObject({ id: 'example:BrowserWindow', checked: true });
      const openRecent = find(model, 'menu:openRecent');
      expect(openRecent?.kind === 'submenu' && nodes(openRecent.children).map((node) => [node.id, node.label])).toEqual([
        ['recent:0', '/home/me/fiddles/one'],
        ['recent:1', '/home/me/fiddles/two'],
        ['recent:clear', 'clearRecent'],
      ]);
    } finally {
      recent.folders = [];
    }
    const empty = find(toMenuModel(build({ platform: 'win32' }), 'win32'), 'menu:openRecent');
    expect(empty?.kind === 'submenu' && empty.children).toEqual([{ kind: 'item', id: 'recent:none', label: 'noRecent', enabled: false }]);
  });

  it('says Hide or Show and Run or Stop per window, like the native menu', () => {
    const busy = toMenuModel(build({ platform: 'win32', win: windowState({ layout: { sidebar: false }, run: { status: 'running', bisect: null } }) }), 'win32');
    expect(find(busy, 'view.toggleSidebar')).toMatchObject({ label: 'Show sidebar' });
    expect(find(busy, 'run.toggle')).toMatchObject({ label: 'Stop', accelerator: 'Ctrl+R' });
  });

  it('opens a recent folder and an example in the window the click came from', () => {
    recent.folders = ['/tmp/f1'];
    try {
      const template = build({ platform: 'linux', focused: 'the-window' });
      const item = (id: string): Item => {
        let found: Item | undefined;
        walk(template, (candidate) => void (candidate.id === id && (found = candidate)));
        if (!found) throw new Error(`no ${id}`);
        return found;
      };
      item('recent:0').click?.({} as Electron.MenuItem, undefined, {} as Electron.KeyboardEvent);
      expect(documents.openFolderIn).toHaveBeenCalledWith('the-window', '/tmp/f1');
      item('example:Menu').click?.({} as Electron.MenuItem, undefined, {} as Electron.KeyboardEvent);
      expect(documents.showMeIn).toHaveBeenCalledWith('the-window', 'Menu');
    } finally {
      recent.folders = [];
    }
  });
});

// installMenu's runtime state: the Develop menu's title bar menu bar toggle (`dev.toggleMenuBar`).
// @feature workspace.menubar
describe('title bar menu bar toggle', () => {
  /** The StateHub as installMenu uses it: a dev build with these windows registered. */
  function fakeHub(windowIds: string[]) {
    return {
      app: { dev: true, settings: { keybindings: {} } },
      windowIds,
      getWindow: (windowId: string) => (windowIds.includes(windowId) ? windowState() : undefined),
      updateWindow: vi.fn<(windowId: string, patch: { menuBar?: MenuNode[] }) => number>(() => 1),
      onChange: vi.fn(),
    };
  }
  /** installMenu rebuilds on the next turn of the event loop. */
  const rebuilt = () => new Promise<void>((resolve) => setImmediate(resolve));
  /** Develop's toggle item in the native menu set last. */
  const nativeToggle = () => {
    const template = electron.Menu.setApplicationMenu.mock.calls.at(-1)?.[0] as Item[];
    return menu(template, 'Develop').find((item) => item.id === 'dev.toggleMenuBar');
  };
  const topLevel = (model: MenuNode[]) => model.map((node) => (node.kind === 'submenu' ? node.label : node.kind));

  it('shows the bar in every window on macOS, with the Linux menus, then takes it away again', async () => {
    const hub = fakeHub(['w1', 'w2']);
    installMenu({ registry, hub, platform: 'darwin' } as unknown as Services);
    await rebuilt();
    // macOS has the OS menu bar: nothing is pushed, and the toggle is unchecked.
    expect(hub.updateWindow).not.toHaveBeenCalled();
    expect(nativeToggle()).toMatchObject({ type: 'checkbox', checked: false });

    expect(toggleWindowMenuBar()).toBe(true);
    await rebuilt();
    expect(hub.updateWindow.mock.calls.map(([windowId]) => windowId)).toEqual(['w1', 'w2']);
    const pushed = hub.updateWindow.mock.calls[0]![1].menuBar!;
    expect(menuBarSchema.safeParse(pushed).success).toBe(true);
    expect(topLevel(pushed)).toEqual(['File', 'Edit', 'View', 'Run', 'Window', 'Develop', 'Help']);
    // Linux menus: Quit is in File, with Ctrl+Q written the Linux way.
    const file = pushed[0]?.kind === 'submenu' ? pushed[0].children : [];
    expect(file.at(-1)).toMatchObject({ id: 'role:quit', label: 'Quit Electron Fiddle', accelerator: 'Ctrl+Q' });
    // The toggle is checked now, in the pushed bar and in the native menu.
    const develop = pushed.find((node) => node.kind === 'submenu' && node.id === 'menu:develop');
    expect(develop?.kind === 'submenu' && develop.children[0]).toMatchObject({ id: 'dev.toggleMenuBar', checked: true });
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

  it('starts with the bar on Windows and Linux, where the toggle hides it', async () => {
    for (const platform of ['win32', 'linux'] as const) {
      const hub = fakeHub(['w']);
      installMenu({ registry, hub, platform } as unknown as Services);
      await rebuilt();
      expect(hub.updateWindow).toHaveBeenCalledTimes(1);
      expect(topLevel(hub.updateWindow.mock.calls[0]![1].menuBar!)).toEqual(['File', 'Edit', 'View', 'Run', 'Window', 'Develop', 'Help']);
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
