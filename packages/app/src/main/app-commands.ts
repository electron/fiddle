/** Handlers for the commands in src/shared/commands.ts. */
import { Window } from '../ipc/main';
import type { CommandRegistry } from './commands';
import { registerDocumentCommands } from './documents/commands';
import { openGistDialog } from './github/ipc';
import { registerRunCommands } from './run/commands';
import { getWindow } from './windows';

export function registerCommands(
  registry: CommandRegistry,
  openWindow: () => Promise<unknown>,
): void {
  registry.register('app.newWindow', async () => {
    await openWindow();
  });
  // Documents slice: the File menu.
  registerDocumentCommands(registry);
  registry.register('view.reload', ({ windowId }) => {
    getWindow(windowId)?.webContents.reload();
  });
  registry.register('view.toggleDevTools', ({ windowId }) => {
    getWindow(windowId)?.webContents.toggleDevTools();
  });
  // Shell slice: these act on view state and Monaco, so the window handles them.
  for (const id of [
    'view.toggleSplit',
    'view.toggleSidebar',
    'view.toggleConsole',
    'editor.toggleSoftWrap',
    'editor.toggleMinimap',
    'editor.format',
  ] as const) {
    registry.register(id, ({ windowId }) => {
      const contents = getWindow(windowId)?.webContents;
      if (contents) Window.getDispatcher(contents)?.dispatchCommand(id);
    });
  }
  // App UX slice: the command palette and the tour live in the window.
  for (const id of ['app.commandPalette', 'help.showTour'] as const) {
    registry.register(id, ({ windowId }) => {
      const contents = getWindow(windowId)?.webContents;
      if (contents) Window.getDispatcher(contents)?.dispatchCommand(id);
    });
  }
  // Versions and run slice: run, package, make and bisect.
  registerRunCommands(registry);
  // Gists slice: the dialogs live in the window.
  registry.register('gist.publish', ({ windowId }) => openGistDialog(windowId, 'publish'));
  registry.register('gist.open', ({ windowId }) => openGistDialog(windowId, 'open'));
  registry.register('gist.history', ({ windowId }) => openGistDialog(windowId, 'history'));
}
