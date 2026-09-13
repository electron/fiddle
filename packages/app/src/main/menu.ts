/**
 * The native application menu, built from the shared command definitions.
 * Role items get explicit, translated labels. The menu is rebuilt when
 * something it shows changes (enablement, keybindings, recent folders,
 * locale, the focused window), so enablement follows the focused window.
 */
import { app, Menu, type MenuItemConstructorOptions } from 'electron';

import { commandIds, commands, type CommandId } from '../shared/commands';
import { SHOW_ME_EXAMPLES } from '../shared/examples';
import { effectiveAccelerator, type Keybindings } from '../shared/settings';
import type { Platform } from '../shared/stores';
import type { CommandRegistry } from './commands';
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
import { focusedWindowId, windowIdOf } from './windows';

const separator: MenuItemConstructorOptions = { type: 'separator' };

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

function buildMenuTemplate(
  registry: CommandRegistry,
  platform: Platform,
  focused: string | undefined,
  /** The user's overrides; `null` unbinds. */
  keybindings: Keybindings,
): MenuItemConstructorOptions[] {
  const isMac = platform === 'darwin';
  const name = t('appMenu');

  const command = (id: CommandId): MenuItemConstructorOptions => ({
    id,
    label: t(commands[id].label),
    accelerator: effectiveAccelerator(id, platform, keybindings),
    enabled: registry.isEnabled(id, focused),
    click: (_item, window) => {
      registry
        .run(id, { windowId: windowIdOf(window) ?? focused })
        .catch((error: unknown) => {
          log.error(`command ${id} failed`, error);
        });
    },
  });

  const quit: MenuItemConstructorOptions = { role: 'quit', label: t('quit', { name }) };

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

  const windowItems: MenuItemConstructorOptions[] = isMac
    ? [
        { role: 'minimize', label: t('minimize') },
        { role: 'zoom', label: t('zoom') },
        { role: 'close', label: t('close') },
        separator,
        { role: 'front', label: t('bringAllToFront') },
      ]
    : [
        { role: 'minimize', label: t('minimize') },
        { role: 'close', label: t('close') },
      ];

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
        separator,
        command('file.save'),
        command('file.saveAs'),
        command('file.saveAsForge'),
        separator,
        showMeMenu(focused),
        separator,
        command('file.close'),
        ...(isMac ? [] : [separator, command('app.preferences'), separator, quit]),
      ],
    },
    {
      label: t('edit'),
      submenu: [
        { role: 'undo', label: t('undo') },
        { role: 'redo', label: t('redo') },
        separator,
        { role: 'cut', label: t('cut') },
        { role: 'copy', label: t('copy') },
        { role: 'paste', label: t('paste') },
        { role: 'selectAll', label: t('selectAll') },
      ],
    },
    {
      label: t('view'),
      submenu: [
        command('app.commandPalette'),
        separator,
        command('view.reload'),
        command('view.toggleDevTools'),
        separator,
        command('view.toggleSidebar'),
        command('view.toggleConsole'),
        command('view.toggleSplit'),
        command('editor.toggleSoftWrap'),
        command('editor.toggleMinimap'),
        command('editor.format'),
        separator,
        { role: 'togglefullscreen', label: t('toggleFullScreen') },
      ],
    },
    // F5 is a second, hidden accelerator for run.toggle.
    {
      label: t('runMenu'),
      submenu: [
        command('run.toggle'),
        { ...command('run.toggle'), id: 'run.toggle.f5', accelerator: 'F5', visible: false },
        separator,
        command('bisect.toggle'),
        separator,
        command('run.package'),
        command('run.make'),
      ],
    },
    { label: t('window'), submenu: windowItems },
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
        ...(isMac ? [] : [separator, command('help.about')]),
      ],
    },
  ];
}

export function installMenu({ registry, hub, platform }: Services): void {
  let scheduled = false;
  let shown: string | undefined;
  const refresh = () => {
    if (scheduled) return;
    scheduled = true;
    setImmediate(() => {
      scheduled = false;
      const focused = focusedWindowId();
      const { keybindings } = hub.app.settings;
      // Store changes come up to 10 times a second during downloads; rebuild
      // only when something the menu shows has changed.
      const key = JSON.stringify([
        focused,
        hub.app.locale,
        keybindings,
        recentFolders(),
        focused && currentTemplateName(focused),
        commandIds.filter((id) => registry.isEnabled(id, focused)),
      ]);
      if (key === shown) return;
      shown = key;
      Menu.setApplicationMenu(Menu.buildFromTemplate(buildMenuTemplate(registry, platform, focused, keybindings)));
    });
  };
  hub.onChange(refresh);
  app.on('browser-window-focus', refresh);
  app.on('browser-window-blur', refresh);
  refresh();
}
