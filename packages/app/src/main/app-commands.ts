/** Every command handler, for the definitions in src/shared/commands.ts. */
import { app, shell } from 'electron';

import type { CommandId } from '../shared/commands';
import type { CommandRegistry } from './commands';
import { closeWindow, newFiddleIn, openFiddleWindow, openFolderIn, saveIn, withErrorDialog } from './documents/service';
import { log, logsDir } from './log';
import { packageFiddle } from './packaging/service';
import { copyDiagnostics } from './platform/diagnostics';
import { openExternalLink } from './security';
import type { Services } from './services';
import { getWindow, sendWindowCommand } from './windows';

/** Handlers that act on Monaco, view state or a dialog in the window: sent there as `Window.Command`. */
const FORWARDED = [
  'view.toggleSplit',
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
] as const satisfies readonly CommandId[];

const LINKS = {
  'help.fiddleRepository': 'https://github.com/electron/fiddle',
  'help.electronRepository': 'https://github.com/electron/electron',
  'help.reportIssue': 'https://github.com/electron/fiddle/issues',
} as const;

export function registerCommands(registry: CommandRegistry, services: Services): void {
  const { hub, runs, bisect } = services;
  for (const id of FORWARDED) registry.register(id, ({ windowId }) => sendWindowCommand(windowId, id));

  registry.register('app.newWindow', async () => {
    await openFiddleWindow();
  });
  registry.register('app.preferences', ({ windowId }) => {
    if (windowId) hub.updateWindow(windowId, { view: 'settings' });
  });
  registry.register('view.reload', ({ windowId }) => getWindow(windowId)?.webContents.reload());
  registry.register('view.toggleDevTools', ({ windowId }) => getWindow(windowId)?.webContents.toggleDevTools());

  // The File menu.
  registry.register('file.newFiddle', ({ windowId }) => withErrorDialog(windowId, () => newFiddleIn(windowId, 'template')));
  registry.register('file.newTest', ({ windowId }) => withErrorDialog(windowId, () => newFiddleIn(windowId, 'test')));
  registry.register('file.open', ({ windowId }) => withErrorDialog(windowId, () => openFolderIn(windowId)));
  registry.register('file.save', ({ windowId }) => withErrorDialog(windowId, () => saveIn(windowId!, 'save')));
  registry.register('file.saveAs', ({ windowId }) => withErrorDialog(windowId, () => saveIn(windowId!, 'saveAs')));
  registry.register('file.saveAsForge', ({ windowId }) => withErrorDialog(windowId, () => saveIn(windowId!, 'forge')));
  registry.register('file.close', ({ windowId }) => closeWindow(windowId));

  // Run, package, make and bisect.
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

  // The Help menu.
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
}
