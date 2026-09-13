/**
 * The native application menu, built from the shared command definitions.
 * Role items get explicit, translated labels. The menu is rebuilt when a store
 * changes or focus moves, so enablement follows the focused window.
 */
import { app, Menu, type MenuItemConstructorOptions } from 'electron';

import { commands, type CommandId } from '../shared/commands';
import { effectiveAccelerator, type Keybindings } from '../shared/settings';
import type { Platform } from '../shared/stores';
import type { CommandRegistry } from './commands';
import { documentMenus } from './documents/commands';
import { t } from './i18n';
import { log } from './log';
import type { StateHub } from './state-hub';
import { focusedWindowId, windowIdOf } from './windows';

const separator: MenuItemConstructorOptions = { type: 'separator' };

export function buildMenuTemplate(
  registry: CommandRegistry,
  platform: Platform,
  focused: string | undefined,
  /** Settings slice: the user's overrides; `null` unbinds. */
  keybindings: Keybindings = {},
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
        // Documents slice: File menu items.
        command('file.newFiddle'),
        command('file.newTest'),
        command('app.newWindow'),
        separator,
        command('file.open'),
        documentMenus(focused).openRecent,
        separator,
        command('file.save'),
        command('file.saveAs'),
        command('file.saveAsForge'),
        separator,
        documentMenus(focused).showMe,
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
    // Versions and run slice. F5 is a second, hidden accelerator for run.toggle.
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
    // App UX slice: other slices add their Help items here.
    {
      role: 'help',
      label: t('help'),
      submenu: [
        command('help.showTour'),
        // Platform slice: links, logs, diagnostics and (outside macOS) About.
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

export function installMenu(
  registry: CommandRegistry,
  hub: StateHub,
  platform: Platform,
): void {
  let scheduled = false;
  const refresh = () => {
    if (scheduled) return;
    scheduled = true;
    setImmediate(() => {
      scheduled = false;
      const template = buildMenuTemplate(
        registry,
        platform,
        focusedWindowId(),
        hub.app.settings.keybindings,
      );
      Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    });
  };
  hub.onChange(refresh);
  app.on('browser-window-focus', refresh);
  app.on('browser-window-blur', refresh);
  refresh();
}
