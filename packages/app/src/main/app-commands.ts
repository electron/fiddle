import { app, BrowserWindow, Menu, shell, webContents } from 'electron';

import type { CommandId } from '../shared/commands';
import type { CommandRegistry } from './commands';
import {
  closeWindow,
  newFiddleIn,
  openFiddleWindow,
  openFolderIn,
  saveIn,
  withErrorDialog,
} from './documents/service';
import { log, logsDir } from './log';
import { toggleWindowMenuBar } from './menu';
import { packageFiddle } from './packaging/service';
import { copyDiagnostics } from './platform/diagnostics';
import { openExternalLink } from './security';
import type { Services } from './services';
import { getWindow, sendWindowCommand, windowIdOf } from './windows';

/** Handlers that act on Monaco, view state or a dialog in the window: sent there as `Window.Command`. */
const FORWARDED = [
  'view.toggleSplit',
  'editor.moveTabLeft',
  'editor.moveTabRight',
  'view.toggleSidebar',
  'view.toggleConsole',
  'editor.toggleSoftWrap',
  'editor.toggleMinimap',
  'editor.format',
  'app.commandPalette',
  'help.showTour',
  'gist.publish',
  'gist.open',
  'gist.history',
  // Handled in the renderer, for menus and keybindings.
  'console.clear',
  'editor.formatAll',
  'editor.formatSelection',
  'editor.goToDefinition',
  'editor.findReferences',
  'editor.toggleTabFocus',
] as const satisfies readonly CommandId[];

/**
 * Undo, redo and select all go to the focused Monaco editor, or run where focus
 * is. Another page with focus (DevTools), or on macOS a native dialog, gets them
 * the way the native roles would send them.
 */
function editCommand(
  windowId: string | undefined,
  action: 'undo' | 'redo' | 'selectAll',
): void {
  if (!BrowserWindow.getFocusedWindow()) {
    if (process.platform === 'darwin') Menu.sendActionToFirstResponder(`${action}:`);
    return;
  }
  const focused = webContents.getFocusedWebContents();
  if (focused && focused !== getWindow(windowId)?.webContents) focused[action]();
  else sendWindowCommand(windowId, `edit.${action}`);
}

const LINKS = {
  'help.fiddleRepository': 'https://github.com/electron/fiddle',
  'help.electronRepository': 'https://github.com/electron/electron',
  'help.reportIssue': 'https://github.com/electron/fiddle/issues',
} as const;

export function registerCommands(registry: CommandRegistry, services: Services): void {
  const { hub, runs, bisect } = services;
  for (const id of FORWARDED)
    registry.register(id, ({ windowId }) => sendWindowCommand(windowId, id));

  registry.register('app.newWindow', async () => {
    await openFiddleWindow();
  });
  registry.register('app.preferences', ({ windowId }) => {
    if (windowId) hub.updateWindow(windowId, { view: 'settings' });
  });
  registry.register('view.reload', ({ windowId }) =>
    getWindow(windowId)?.webContents.reload(),
  );
  registry.register('view.toggleDevTools', ({ windowId }) =>
    getWindow(windowId)?.webContents.toggleDevTools(),
  );
  registry.register('view.reloadAllWindows', () => {
    for (const win of BrowserWindow.getAllWindows())
      if (windowIdOf(win)) win.webContents.reload();
  });
  for (const action of ['undo', 'redo', 'selectAll'] as const) {
    registry.register(`edit.${action}`, ({ windowId }) => editCommand(windowId, action));
  }

  registry.register('file.newFiddle', ({ windowId }) =>
    withErrorDialog(windowId, () => newFiddleIn(windowId, 'template')),
  );
  registry.register('file.newTest', ({ windowId }) =>
    withErrorDialog(windowId, () => newFiddleIn(windowId, 'test')),
  );
  registry.register('file.open', ({ windowId }) =>
    withErrorDialog(windowId, () => openFolderIn(windowId)),
  );
  registry.register('file.save', ({ windowId }) =>
    withErrorDialog(windowId, () => saveIn(windowId!, 'save')),
  );
  registry.register('file.saveAs', ({ windowId }) =>
    withErrorDialog(windowId, () => saveIn(windowId!, 'saveAs')),
  );
  registry.register('file.saveAsForge', ({ windowId }) =>
    withErrorDialog(windowId, () => saveIn(windowId!, 'forge')),
  );
  registry.register('file.close', ({ windowId }) => closeWindow(windowId));

  registry.register('run.toggle', ({ windowId }) => {
    if (windowId) runs.toggle(windowId);
  });
  for (const task of ['package', 'make'] as const) {
    registry.register(`run.${task}`, async ({ windowId }) => {
      if (windowId) await packageFiddle(windowId, task, services);
    });
  }
  // Stops a bisect in progress; otherwise the window shows the range dialog.
  registry.register('bisect.toggle', ({ windowId }) => {
    if (windowId && bisect.isActive(windowId)) bisect.stop(windowId);
    else sendWindowCommand(windowId, 'bisect.toggle');
  });

  registry.register('help.about', () => app.showAboutPanel());
  registry.register('help.openLogsFolder', async () => {
    const dir = logsDir();
    const error = dir ? await shell.openPath(dir) : 'no logs folder';
    if (error) log.warn('could not open the logs folder', error);
  });
  registry.register('help.copyDiagnostics', () => copyDiagnostics(hub));
  for (const [id, url] of Object.entries(LINKS) as [keyof typeof LINKS, string][]) {
    registry.register(id, () => openExternalLink(url));
  }

  // `devOnly`: disabled in the packaged app.
  registry.register('dev.toggleMenuBar', () => {
    toggleWindowMenuBar();
  });
}
