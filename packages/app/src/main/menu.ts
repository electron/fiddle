/**
 * Item `id`s: the command ID, `role:<role>`, `menu:<name>`, `recent:<n>` or
 * `example:<name>`. On Windows and Linux the same template, built per window, is
 * also the title bar's menu bar (`Window.menuBar`).
 */
import { app, Menu, type MenuItemConstructorOptions } from 'electron';

import { commands, getCommand, type CommandId, type LabelKey } from '../shared/commands';
import { SHOW_ME_EXAMPLES } from '../shared/examples';
import { ErrorCode, FiddleError } from '../shared/errors';
import { effectiveAccelerator, type Keybindings } from '../shared/settings';
import type { Platform, WindowState } from '../shared/stores';
import type { CommandRegistry } from './commands';
import { describeMenu, dumpMenu } from './context-menu';
import {
  clearRecentFolders,
  currentTemplateName,
  openFolderIn,
  recentFolders,
  showMeIn,
  withErrorDialog,
} from './documents/service';
import { t, tm } from './i18n';
import { log } from './log';
import { activateMenuItem, hasWindowMenuBar, toMenuModel } from './menu-model';
import type { Services } from './services';
import { focusedWindowId, getWindow, windowIdOf } from './windows';

type Role = NonNullable<MenuItemConstructorOptions['role']>;

const separator: MenuItemConstructorOptions = { type: 'separator' };

/** A role item with our label. Its `id` is `role:<role>`. */
const role = (
  name: Role,
  label: string,
  extra: Partial<MenuItemConstructorOptions> = {},
): MenuItemConstructorOptions => ({
  id: `role:${name}`,
  role: name,
  label,
  ...extra,
});

/** What the menu shows, besides the registry's enablement. */
export interface MenuState {
  platform: Platform;
  /** The focused app window; undefined when none has focus (macOS). */
  focused: string | undefined;
  win: WindowState | undefined;
  fullScreen: boolean;
  /** The user's overrides; `null` unbinds. */
  keybindings: Keybindings;
  /** Unpackaged (development and test) builds (`App.dev`) have the Develop menu. */
  dev: boolean;
  /** Whether windows draw the title bar menu bar now; Develop's toggle is checked while they do. */
  menuBar: boolean;
}

/** A recent folder opens in the window the click came from. */
function openRecentMenu(focused: string | undefined): MenuItemConstructorOptions {
  const td = tm('mainDocuments');
  const recent = recentFolders();
  const target = (window: Electron.BaseWindow | undefined) =>
    windowIdOf(window) ?? focused;
  return {
    id: 'menu:openRecent',
    label: t('openRecent'),
    submenu:
      recent.length === 0
        ? [{ id: 'recent:none', label: td('noRecent'), enabled: false }]
        : [
            ...recent.map((dir, index): MenuItemConstructorOptions => ({
              id: `recent:${index}`,
              label: dir,
              click: (_item, window) =>
                void withErrorDialog(target(window), () =>
                  openFolderIn(target(window), dir),
                ),
            })),
            separator,
            {
              id: 'recent:clear',
              label: td('clearRecent'),
              click: () => clearRecentFolders(),
            },
          ],
  };
}

function showMeMenu(focused: string | undefined): MenuItemConstructorOptions {
  const current = focused ? currentTemplateName(focused) : undefined;
  const target = (window: Electron.BaseWindow | undefined) =>
    windowIdOf(window) ?? focused;
  return {
    id: 'menu:showMe',
    label: t('showMe'),
    submenu: SHOW_ME_EXAMPLES.map((name): MenuItemConstructorOptions => ({
      id: `example:${name}`,
      label: name,
      type: 'radio',
      checked: current === name,
      click: (_item, window) =>
        void withErrorDialog(target(window), () => showMeIn(target(window), name)),
    })),
  };
}

function developMenu(
  command: (id: CommandId, label?: LabelKey) => MenuItemConstructorOptions,
  menuBar: boolean,
): MenuItemConstructorOptions {
  return {
    id: 'menu:develop',
    label: t('develop'),
    submenu: [
      { ...command('dev.toggleMenuBar'), type: 'checkbox', checked: menuBar },
      separator,
      command('view.reload'),
      command('view.reloadAllWindows'),
    ],
  };
}

export function buildMenuTemplate(
  registry: CommandRegistry,
  state: MenuState,
): MenuItemConstructorOptions[] {
  const { platform, focused, win, keybindings } = state;
  const isMac = platform === 'darwin';
  const name = t('appMenu');

  /** A registry command's item. `label` says what it will do now (Hide sidebar) instead of its own. */
  const command = (id: CommandId, label?: LabelKey): MenuItemConstructorOptions => ({
    id,
    label: t(label ?? commands[id].label),
    // A keybinding scoped to a context (Clear console's, to the console) is the
    // renderer's to dispatch: registered here, it would fire everywhere.
    accelerator: getCommand(id).context
      ? undefined
      : effectiveAccelerator(id, platform, keybindings),
    enabled: registry.isEnabled(id, focused),
    click: (_item, window) => {
      registry
        .run(id, { windowId: windowIdOf(window) ?? focused })
        .catch((error: unknown) => {
          log.error(`command ${id} failed`, error);
        });
    },
  });

  const layout = win?.layout;
  const busy = (win?.run?.status ?? 'ready') !== 'ready';
  const bisect = win?.run?.bisect;
  const bisecting = bisect != null && bisect.result === null;

  const quit = role('quit', platform === 'win32' ? t('exit') : t('quit', { name }));

  const appMenu: MenuItemConstructorOptions[] = isMac
    ? [
        {
          id: 'menu:app',
          label: name,
          submenu: [
            role('about', t('about', { name })),
            separator,
            command('app.preferences'),
            separator,
            role('services', t('services')),
            separator,
            role('hide', t('hide', { name })),
            role('hideOthers', t('hideOthers')),
            role('unhide', t('showAll')),
            separator,
            quit,
          ],
        },
      ]
    : [];

  return [
    ...appMenu,
    {
      id: 'menu:file',
      label: t('file'),
      submenu: [
        command('file.newFiddle'),
        command('file.newTest'),
        command('app.newWindow'),
        separator,
        command('file.open'),
        openRecentMenu(focused),
        command('gist.open'),
        separator,
        command('file.save'),
        command('file.saveAs'),
        command('file.saveAsForge'),
        separator,
        command('gist.publish'),
        command('gist.history'),
        separator,
        showMeMenu(focused),
        separator,
        // Elsewhere than macOS, Settings and Exit live here (there's no app menu).
        ...(isMac ? [] : [command('app.preferences'), separator]),
        command('file.close'),
        ...(isMac ? [] : [separator, quit]),
      ],
    },
    {
      id: 'menu:edit',
      label: t('edit'),
      submenu: [
        // Commands, not roles, so they reach the focused Monaco editor.
        command('edit.undo'),
        command('edit.redo'),
        separator,
        role('cut', t('cut')),
        role('copy', t('copy')),
        role('paste', t('paste')),
        command('edit.selectAll'),
        separator,
        command('editor.format'),
        command('editor.formatSelection'),
        command('editor.formatAll'),
        separator,
        command('console.clear'),
      ],
    },
    {
      id: 'menu:view',
      label: t('view'),
      submenu: [
        command('app.commandPalette'),
        separator,
        // Main knows the sidebar and console state, so these say Hide or Show.
        command(
          'view.toggleSidebar',
          (layout?.sidebar ?? true) ? 'hideSidebar' : 'showSidebar',
        ),
        command(
          'view.toggleConsole',
          (layout?.consoleVisible ?? true) ? 'hideConsole' : 'showConsole',
        ),
        command('view.toggleSplit'),
        separator,
        // Their state lives in the renderer, so plain toggles.
        command('editor.toggleSoftWrap'),
        command('editor.toggleMinimap'),
        command('editor.toggleTabFocus'),
        separator,
        role('resetZoom', t('actualSize'), { accelerator: 'CmdOrCtrl+0' }),
        role('zoomIn', t('zoomIn'), { accelerator: 'CmdOrCtrl+Plus' }),
        role('zoomOut', t('zoomOut'), { accelerator: 'CmdOrCtrl+-' }),
        separator,
        // The role brings the platform's key (Ctrl+Cmd+F, or F11). On
        // macOS 26, Electron 39.1–44 also shows AppKit's Globe+F copy of this
        // item (electron/electron#52821); that second item isn't ours.
        role(
          'togglefullscreen',
          t(state.fullScreen ? 'exitFullScreen' : 'enterFullScreen'),
        ),
      ],
    },
    // run.toggle's second default, F5, is dispatched by the renderer.
    {
      id: 'menu:run',
      label: t('runMenu'),
      submenu: [
        command('run.toggle', busy ? 'stop' : 'run'),
        separator,
        command('bisect.toggle', bisecting ? 'stopBisect' : undefined),
        separator,
        command('run.package'),
        command('run.make'),
      ],
    },
    {
      // The Window menu proper (`role`), so macOS lists the open windows in it.
      id: 'menu:window',
      role: 'window',
      label: t('window'),
      submenu: [
        role('minimize', t('minimize')),
        ...(isMac ? [role('zoom', t('zoom'))] : []),
        separator,
        // The editor tabs, where macOS apps keep their tab commands.
        command('editor.moveTabLeft'),
        command('editor.moveTabRight'),
        ...(isMac ? [separator, role('front', t('bringAllToFront'))] : []),
      ],
    },
    // Unpackaged builds only. The reload commands exist in every build; only the toggle is `devOnly`.
    ...(state.dev ? [developMenu(command, state.menuBar)] : []),
    {
      id: 'menu:help',
      role: 'help',
      label: t('help'),
      submenu: [
        command('help.showTour'),
        separator,
        command('help.fiddleRepository'),
        command('help.electronRepository'),
        command('help.reportIssue'),
        separator,
        command('help.openLogsFolder'),
        command('help.copyDiagnostics'),
        separator,
        command('view.toggleDevTools'),
        ...(isMac ? [] : [separator, command('help.about')]),
      ],
    },
  ];
}

/** The last template built for each window's title bar menu bar, for `ActivateMenuItem`. */
const windowTemplates = new Map<string, MenuItemConstructorOptions[]>();

/** Set by `installMenu`: flips whether windows draw the title bar menu bar, and returns the new value. */
let toggleMenuBar: (() => boolean) | undefined;

export function installMenu({ registry, hub, platform }: Services): void {
  const dev = hub.app.dev === true;
  // Whether windows draw the menu bar in their title bar. `dev.toggleMenuBar` flips it at runtime.
  let inWindow = hasWindowMenuBar(platform);
  // Forced onto macOS, the title bar shows what Linux users get.
  const barPlatform: Platform = platform === 'darwin' ? 'linux' : platform;
  let scheduled = false;
  let shown: string | undefined;
  /** What each window's menu bar shows now, to push only real changes. */
  const pushed = new Map<string, string>();
  const stateFor = (
    focused: string | undefined,
    statePlatform = platform,
  ): MenuState => ({
    platform: statePlatform,
    focused,
    win: focused === undefined ? undefined : hub.getWindow(focused),
    fullScreen: getWindow(focused)?.isFullScreen() ?? false,
    keybindings: hub.app.settings.keybindings,
    dev,
    menuBar: inWindow,
  });
  const refresh = () => {
    if (scheduled) return;
    scheduled = true;
    setImmediate(() => {
      scheduled = false;
      const focused = focusedWindowId();
      const template = buildMenuTemplate(registry, stateFor(focused));
      // Downloads change the store often; rebuild only when something the menu shows has changed.
      const key = JSON.stringify([focused, describeMenu(template)]);
      if (key !== shown) {
        shown = key;
        dumpMenu('application menu', template);
        Menu.setApplicationMenu(Menu.buildFromTemplate(template));
      }
      if (inWindow) refreshWindowMenus();
      else clearWindowMenus();
    });
  };
  /** Windows and Linux: each window's title bar gets the template built with itself as the focused window. */
  const refreshWindowMenus = () => {
    const registered = new Set(hub.windowIds);
    for (const windowId of [...windowTemplates.keys()]) {
      if (registered.has(windowId)) continue;
      windowTemplates.delete(windowId);
      pushed.delete(windowId);
    }
    for (const windowId of registered) {
      const template = buildMenuTemplate(registry, stateFor(windowId, barPlatform));
      windowTemplates.set(windowId, template);
      const menuBar = toMenuModel(template, barPlatform);
      const key = JSON.stringify(menuBar);
      if (pushed.get(windowId) === key) continue;
      pushed.set(windowId, key);
      hub.updateWindow(windowId, { menuBar });
    }
  };
  /** The toggle turned the bar off: take it out of every window that has one (an absent `menuBar` draws none). */
  const clearWindowMenus = () => {
    for (const windowId of pushed.keys()) {
      if (hub.getWindow(windowId)) hub.updateWindow(windowId, { menuBar: undefined });
    }
    pushed.clear();
    windowTemplates.clear();
  };
  toggleMenuBar = () => {
    inWindow = !inWindow;
    log.info('title bar menu bar', inWindow ? 'on' : 'off');
    refresh();
    return inWindow;
  };
  hub.onChange(refresh);
  app.on('browser-window-focus', refresh);
  app.on('browser-window-blur', refresh);
  // A new window registers its store in the same tick it's created in, so the
  // deferred refresh fills its `menuBar` before the page first reads the store.
  app.on('browser-window-created', (_event, win) => {
    win.on('enter-full-screen', refresh);
    win.on('leave-full-screen', refresh);
    refresh();
  });
  refresh();
}

/** `dev.toggleMenuBar`: shows or hides the title bar menu bar in every window, whatever the platform. Returns whether it is now drawn. */
export function toggleWindowMenuBar(): boolean {
  if (!toggleMenuBar)
    throw new FiddleError(ErrorCode.unavailable, 'The menu is not installed yet');
  return toggleMenuBar();
}

/** `Window.ActivateMenuItem`: chooses `id` in this window's menu bar, as the native menu would. */
export function activateWindowMenuItem(windowId: string, id: string): void {
  const template = windowTemplates.get(windowId);
  const win = getWindow(windowId);
  if (!template || !win)
    throw new FiddleError(ErrorCode.unavailable, `Window ${windowId} has no menu bar`);
  activateMenuItem(template, id, win);
}
