/** File menu: command handlers and the dynamic Open recent and Show me submenus. */
import type { MenuItemConstructorOptions } from 'electron';

import { SHOW_ME_EXAMPLES } from '../../fiddle/examples';
import type { CommandRegistry } from '../commands';
import { t, tm } from '../i18n';
import { focusedWindowId } from '../windows';
import {
  clearRecentFolders,
  closeWindow,
  currentTemplateName,
  newFiddleIn,
  openFolderIn,
  recentFolders,
  saveIn,
  showMeIn,
  withErrorDialog,
} from './service';

export function registerDocumentCommands(registry: CommandRegistry): void {
  registry.register('file.newFiddle', ({ windowId }) => withErrorDialog(windowId, () => newFiddleIn(windowId, 'template')));
  registry.register('file.newTest', ({ windowId }) => withErrorDialog(windowId, () => newFiddleIn(windowId, 'test')));
  registry.register('file.open', ({ windowId }) => withErrorDialog(windowId, () => openFolderIn(windowId)));
  registry.register('file.save', ({ windowId }) => withErrorDialog(windowId, () => saveIn(windowId!, 'save')));
  registry.register('file.saveAs', ({ windowId }) => withErrorDialog(windowId, () => saveIn(windowId!, 'saveAs')));
  registry.register('file.saveAsForge', ({ windowId }) =>
    withErrorDialog(windowId, () => saveIn(windowId!, 'forge')),
  );
  registry.register('file.close', ({ windowId }) => closeWindow(windowId));
}

/** Built on every menu refresh, so they follow the focused window and the recent list. */
export function documentMenus(focused: string | undefined): {
  openRecent: MenuItemConstructorOptions;
  showMe: MenuItemConstructorOptions;
} {
  const td = tm('mainDocuments');
  const recent = recentFolders();
  const current = focused ? currentTemplateName(focused) : undefined;
  return {
    openRecent: {
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
              { type: 'separator' },
              { label: td('clearRecent'), click: () => clearRecentFolders() },
            ],
    },
    showMe: {
      label: t('showMe'),
      submenu: SHOW_ME_EXAMPLES.map(
        (name): MenuItemConstructorOptions => ({
          label: name,
          type: 'radio',
          checked: current === name,
          click: () => void withErrorDialog(focusedWindowId(), () => showMeIn(focusedWindowId(), name)),
        }),
      ),
    },
  };
}
