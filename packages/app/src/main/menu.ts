/**
 * The native application menu (REQUIREMENTS §17.14), built from the shared
 * command definitions:
 * - macOS: Electron Fiddle, File, Edit, View, Run, Window and Help;
 * - Windows and Linux: the same without the app menu; Settings and Exit are in
 *   File, and About is in Help.
 *
 * Role items get explicit, translated labels. Items whose state main knows
 * (the sidebar, the console, the run, a bisect, full screen) say what they
 * will do, as macOS menus do; the palette keeps the command's own label. The
 * menu is rebuilt whenever anything it shows changes (a label, enablement, a
 * keybinding, recent folders, the locale, the focused window), so it follows
 * the focused window.
 */
import { app, Menu, type MenuItemConstructorOptions } from 'electron';

import { commands, getCommand, type CommandId, type LabelKey } from '../shared/commands';
import { SHOW_ME_EXAMPLES } from '../shared/examples';
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
import type { Services } from './services';
import { focusedWindowId, getWindow, windowIdOf } from './windows';

const separator: MenuItemConstructorOptions = { type: 'separator' };

/** What the menu shows, besides the registry's enablement. */
export interface MenuState {
  platform: Platform;
  /** The focused app window; undefined when none has focus (macOS). */
  focused: string | undefined;
  win: WindowState | undefined;
  /** Whether that window is full screen. */
  fullScreen: boolean;
  /** The user's overrides; `null` unbinds. */
  keybindings: Keybindings;
  /** Unpackaged (development and test) builds add Reload and Reload all windows to View. */
  dev: boolean;
}

/** File → Open recent, from state.json's recent folders. */
function openRecentMenu(): MenuItemConstructorOptions {
  const td = tm('mainDocuments');
  const recent = recentFolders();
  return {
    label: t('openRecent'),
    submenu:
      recent.length === 0
        ? [{ label: td('noRecent'), enabled: false }]
        : [
            ...recent.map(
              (dir): MenuItemConstructorOptions => ({
                label: dir,
                click: () => void withErrorDialog(focusedWindowId(), () => openFolderIn(focusedWindowId(), dir)),
              }),
            ),
            separator,
            { label: td('clearRecent'), click: () => clearRecentFolders() },
          ],
  };
}

/** File → Show me, with the focused window's example checked. */
function showMeMenu(focused: string | undefined): MenuItemConstructorOptions {
  const current = focused ? currentTemplateName(focused) : undefined;
  return {
    label: t('showMe'),
    submenu: SHOW_ME_EXAMPLES.map(
      (name): MenuItemConstructorOptions => ({
        label: name,
        type: 'radio',
        checked: current === name,
        click: () => void withErrorDialog(focusedWindowId(), () => showMeIn(focusedWindowId(), name)),
      }),
    ),
  };
}

export function buildMenuTemplate(registry: CommandRegistry, state: MenuState): MenuItemConstructorOptions[] {
  const { platform, focused, win, keybindings } = state;
  const isMac = platform === 'darwin';
  const name = t('appMenu');

  /** A registry command's item. `label` says what it will do now (Hide sidebar) instead of its own. */
  const command = (id: CommandId, label?: LabelKey): MenuItemConstructorOptions => ({
    id,
    label: t(label ?? commands[id].label),
    // A keybinding scoped to a context (Clear console's, to the console) is the
    // renderer's to dispatch: registered here, it would fire everywhere.
    accelerator: getCommand(id).context ? undefined : effectiveAccelerator(id, platform, keybindings),
    enabled: registry.isEnabled(id, focused),
    click: (_item, window) => {
      registry
        .run(id, { windowId: windowIdOf(window) ?? focused })
        .catch((error: unknown) => {
          log.error(`command ${id} failed`, error);
        });
    },
  });

  // What the stateful items will do, from the focused window's store.
  const layout = win?.layout;
  const busy = (win?.run?.status ?? 'ready') !== 'ready';
  const bisect = win?.run?.bisect;
  const bisecting = bisect != null && bisect.result === null;

  // "Quit Electron Fiddle" (Cmd+Q, Ctrl+Q); Windows says Exit.
  const quit: MenuItemConstructorOptions = {
    role: 'quit',
    label: platform === 'win32' ? t('exit') : t('quit', { name }),
  };

  const appMenu: MenuItemConstructorOptions[] = isMac
    ? [
        {
          label: name,
          submenu: [
            { role: 'about', label: t('about', { name }) },
            separator,
            command('app.preferences'),
            separator,
            { role: 'services', label: t('services') },
            separator,
            { role: 'hide', label: t('hide', { name }) },
            { role: 'hideOthers', label: t('hideOthers') },
            { role: 'unhide', label: t('showAll') },
            separator,
            quit,
          ],
        },
      ]
    : [];

  return [
    ...appMenu,
    {
      label: t('file'),
      submenu: [
        command('file.newFiddle'),
        command('file.newTest'),
        command('app.newWindow'),
        separator,
        command('file.open'),
        openRecentMenu(),
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
      label: t('edit'),
      submenu: [
        // Commands, not roles, so they reach the focused Monaco editor (src/main/app-commands.ts).
        command('edit.undo'),
        command('edit.redo'),
        separator,
        { role: 'cut', label: t('cut') },
        { role: 'copy', label: t('copy') },
        { role: 'paste', label: t('paste') },
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
      label: t('view'),
      submenu: [
        command('app.commandPalette'),
        separator,
        // Layout. Main knows the sidebar and console state, so these say Hide or Show.
        command('view.toggleSidebar', (layout?.sidebar ?? true) ? 'hideSidebar' : 'showSidebar'),
        command('view.toggleConsole', (layout?.consoleVisible ?? true) ? 'hideConsole' : 'showConsole'),
        command('view.toggleSplit'),
        separator,
        // Editor presentation. Its state lives in the renderer, so plain toggles.
        command('editor.toggleSoftWrap'),
        command('editor.toggleMinimap'),
        command('editor.toggleTabFocus'),
        separator,
        // §17.14. The app must stay usable at 200% (§10).
        { role: 'resetZoom', label: t('actualSize'), accelerator: 'CmdOrCtrl+0' },
        { role: 'zoomIn', label: t('zoomIn'), accelerator: 'CmdOrCtrl+Plus' },
        { role: 'zoomOut', label: t('zoomOut'), accelerator: 'CmdOrCtrl+-' },
        separator,
        // The role brings the platform's key (Ctrl+Cmd+F, or F11; §17.14). On
        // macOS 26, Electron 39.1–44 also shows AppKit's Globe+F copy of this
        // item (electron/electron#52821); that second item isn't ours.
        { role: 'togglefullscreen', label: t(state.fullScreen ? 'exitFullScreen' : 'enterFullScreen') },
        // For developing Fiddle itself: unpackaged builds only. The commands stay
        // registered everywhere, for Settings' "Reload all windows", the error
        // view's Reload, the palette and their keys.
        ...(state.dev ? [separator, command('view.reload'), command('view.reloadAllWindows')] : []),
      ],
    },
    // run.toggle's second default, F5, is dispatched by the renderer.
    {
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
      role: 'window',
      label: t('window'),
      submenu: [
        { role: 'minimize', label: t('minimize') },
        ...(isMac ? [{ role: 'zoom' as const, label: t('zoom') }] : []),
        separator,
        // The editor tabs, where macOS apps keep their tab commands.
        command('editor.moveTabLeft'),
        command('editor.moveTabRight'),
        ...(isMac ? [separator, { role: 'front' as const, label: t('bringAllToFront') }] : []),
      ],
    },
    {
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
        // Last, as in VS Code: it's for looking under Fiddle's own hood.
        command('view.toggleDevTools'),
        ...(isMac ? [] : [separator, command('help.about')]),
      ],
    },
  ];
}

export function installMenu({ registry, hub, platform }: Services): void {
  const dev = !app.isPackaged;
  let scheduled = false;
  let shown: string | undefined;
  const refresh = () => {
    if (scheduled) return;
    scheduled = true;
    setImmediate(() => {
      scheduled = false;
      const focused = focusedWindowId();
      const template = buildMenuTemplate(registry, {
        platform,
        focused,
        win: focused === undefined ? undefined : hub.getWindow(focused),
        fullScreen: getWindow(focused)?.isFullScreen() ?? false,
        keybindings: hub.app.settings.keybindings,
        dev,
      });
      // Store changes come up to 10 times a second during downloads; rebuild
      // only when something the menu shows has changed.
      const key = JSON.stringify([focused, describeMenu(template)]);
      if (key === shown) return;
      shown = key;
      dumpMenu('application menu', template);
      Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    });
  };
  hub.onChange(refresh);
  app.on('browser-window-focus', refresh);
  app.on('browser-window-blur', refresh);
  app.on('browser-window-created', (_event, win) => {
    win.on('enter-full-screen', refresh);
    win.on('leave-full-screen', refresh);
  });
  refresh();
}
