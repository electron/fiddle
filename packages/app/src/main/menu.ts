/**
 * The native application menu, built from the shared command definitions.
 * Role items get explicit, translated labels. The menu is rebuilt when a store
 * changes or focus moves, so enablement follows the focused window.
 */
import { app, Menu, type MenuItemConstructorOptions } from 'electron';

import { acceleratorFor, commands, type CommandId } from '../shared/commands';
import type { Platform } from '../shared/stores';
import type { CommandRegistry } from './commands';
import { t } from './i18n';
import { log } from './log';
import type { StateHub } from './state-hub';
import { focusedWindowId, windowIdOf } from './windows';

const separator: MenuItemConstructorOptions = { type: 'separator' };

export function buildMenuTemplate(
  registry: CommandRegistry,
  platform: Platform,
  focused: string | undefined,
): MenuItemConstructorOptions[] {
  const isMac = platform === 'darwin';
  const name = t('appMenu');

  const command = (id: CommandId): MenuItemConstructorOptions => ({
    id,
    label: t(commands[id].label),
    accelerator: acceleratorFor(id, platform),
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
      submenu: [command('app.newWindow'), ...(isMac ? [] : [separator, quit])],
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
        command('view.reload'),
        command('view.toggleDevTools'),
        separator,
        { role: 'togglefullscreen', label: t('toggleFullScreen') },
      ],
    },
    { label: t('window'), submenu: windowItems },
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
      const template = buildMenuTemplate(registry, platform, focusedWindowId());
      Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    });
  };
  hub.onChange(refresh);
  app.on('browser-window-focus', refresh);
  app.on('browser-window-blur', refresh);
  refresh();
}
