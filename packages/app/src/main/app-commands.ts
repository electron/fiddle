import { app, BrowserWindow, Menu, shell, webContents } from 'electron';

import type { CommandId } from '../shared/commands';
import type { CommandRegistry } from './commands';
import { docMoveActiveTab } from './documents/model';
import {
  newFiddleIn,
  openFiddleWindow,
  openFolderIn,
  saveIn,
  setLayout,
  updateDoc,
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
  for (const [id, key] of [
    ['view.toggleSidebar', 'sidebar'],
    ['view.toggleConsole', 'consoleVisible'],
  ] as const) {
    registry.register(id, ({ windowId }) => {
      const layout = windowId ? hub.getWindow(windowId)?.layout : undefined;
      if (layout) setLayout(windowId!, { ...layout, [key]: !layout[key] });
    });
  }
  for (const [id, direction] of [
    ['editor.moveTabLeft', -1],
    ['editor.moveTabRight', 1],
  ] as const) {
    registry.register(id, ({ windowId }) => {
      if (windowId) updateDoc(windowId, (doc) => docMoveActiveTab(doc, direction));
    });
  }
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

  const fileActions: [CommandId, (windowId: string | undefined) => Promise<unknown>][] = [
    ['file.newFiddle', (id) => newFiddleIn(id, 'template')],
    ['file.newTest', (id) => newFiddleIn(id, 'test')],
    ['file.open', (id) => openFolderIn(id)],
    ['file.save', (id) => saveIn(id!, 'save')],
    ['file.saveAs', (id) => saveIn(id!, 'saveAs')],
    ['file.saveAsForge', (id) => saveIn(id!, 'forge')],
  ];
  // Their errors show in a dialog over the window.
  for (const [id, action] of fileActions)
    registry.register(id, ({ windowId }) =>
      withErrorDialog(windowId, () => action(windowId)),
    );
  registry.register('file.close', ({ windowId }) => getWindow(windowId)?.close());

  registry.register('run.toggle', ({ windowId }) => {
    if (windowId) runs.toggle(windowId);
  });
  for (const task of ['package', 'make'] as const) {
    registry.register(`run.${task}`, async ({ windowId }) => {
      if (windowId) await runs.track(packageFiddle(windowId, task, services));
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
