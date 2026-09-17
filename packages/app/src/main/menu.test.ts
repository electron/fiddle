import type { MenuItemConstructorOptions } from 'electron';
import { describe, expect, it, vi } from 'vitest';

import { commandIds, type CommandId } from '../shared/commands';
import { normalizeAccelerator } from '../shared/settings';
import { DEFAULT_LAYOUT, type Platform, type RunState, type WindowLayout, type WindowState } from '../shared/stores';
import type { CommandRegistry } from './commands';
import type { MenuState } from './menu';

vi.mock('electron', () => ({ app: { isPackaged: false, on: vi.fn() }, BrowserWindow: {}, Menu: {} }));
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
vi.mock('./documents/service', () => ({
  clearRecentFolders: vi.fn(),
  currentTemplateName: () => 'BrowserWindow',
  openFolderIn: vi.fn(),
  recentFolders: () => [],
  showMeIn: vi.fn(),
  withErrorDialog: vi.fn(),
}));
vi.mock('./windows', () => ({ focusedWindowId: () => undefined, getWindow: () => undefined, windowIdOf: () => undefined }));

const { buildMenuTemplate } = await import('./menu');

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
  items.map((item) => (item.type === 'separator' ? '---' : (item.id ?? (item.role ? `(${item.role})` : item.label))));

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
  it('adds Reload and Reload all windows to View in development builds only', () => {
    expect(outline(menu(build({ dev: true }), 'View')).slice(-3)).toEqual(['---', 'view.reload', 'view.reloadAllWindows']);
    const release: string[] = [];
    walk(build({ dev: false, platform: 'win32' }), (item) => void (item.id && release.push(item.id)));
    expect(release).not.toContain('view.reload');
    expect(release).not.toContain('view.reloadAllWindows');
    // Their keys still work: the commands stay defined, and the renderer dispatches every keybinding.
    expect(commandIds).toContain('view.reload');
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
    const inMenu = (platform: Platform) => {
      const ids = new Set<string>();
      walk(build({ platform, dev: true }), (item) => void (item.id && ids.add(item.id)));
      return ids;
    };
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
