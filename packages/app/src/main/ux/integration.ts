import path from 'node:path';

import {
  app,
  BrowserWindow,
  Menu,
  Notification,
  type JumpListCategory,
  type MenuItemConstructorOptions,
} from 'electron';

import { findDeepLinkInArgv } from '../../fiddle/deep-link';
import { commands, type CommandId } from '../../shared/commands';
import type { RunState, WindowState } from '../../shared/stores';
import { openFolderIn, recentFolders } from '../documents/service';
import { t, tm } from '../i18n';
import { log } from '../log';
import { appLauncherPath } from '../platform/squirrel';
import type { Services } from '../services';
import { focusedWindowId, getWindow } from '../windows';
import {
  ARG_NEW_FIDDLE,
  ARG_NEW_WINDOW,
  jumpListFolder,
  openFolderArg,
} from './jump-list';
import {
  downloadsFinished,
  finishedWindowOperations,
  runStarted,
  taskbarProgress,
  type FinishedOperation,
  type OperationKind,
} from './progress';

const TITLES = {
  bisect: { ok: 'bisectDone', failed: 'bisectFailed' },
  package: { ok: 'packageDone', failed: 'packageFailed' },
  downloads: { ok: 'downloadsDone', failed: 'downloadsFailed' },
  run: { ok: 'runDone', failed: 'runFailed' },
} as const satisfies Record<OperationKind, { ok: string; failed: string }>;

/** `Window.run`; absent means ready. */
const runOf = (state: WindowState | undefined): RunState | undefined => state?.run;

export function installOsIntegration({ hub, registry }: Services): void {
  const runs = new Map<string, RunState | undefined>();
  const runStarts = new Map<string, number>();
  const shownProgress = new Map<string, string>();
  // Notifications are garbage collected (and lose their click handler) unless referenced.
  const live = new Set<Notification>();
  let versions = hub.app.versions;

  const runCommand = (id: string) => {
    registry
      .run(id, { windowId: focusedWindowId() ?? hub.windowIds[0] })
      .catch((error: unknown) => log.error(`command ${id} failed`, error));
  };

  const openFolder = (dir: string) => {
    openFolderIn(undefined, dir).catch((error: unknown) =>
      log.error('open recent failed', error),
    );
  };

  const showProgress = (windowId: string) => {
    const win = getWindow(windowId);
    if (!win) return;
    const progress = taskbarProgress(hub.app.versions, runOf(hub.getWindow(windowId)));
    const key = JSON.stringify(progress);
    if (shownProgress.get(windowId) === key) return;
    shownProgress.set(windowId, key);
    // Below 0 removes the bar; above 1 is indeterminate.
    if (progress.mode === 'none') win.setProgressBar(-1);
    else if (progress.mode === 'indeterminate')
      win.setProgressBar(2, { mode: 'indeterminate' });
    else win.setProgressBar(progress.progress);
  };

  const attention = (win: BrowserWindow) => {
    if (process.platform === 'darwin') {
      app.dock?.bounce('informational');
    } else {
      win.flashFrame(true);
      win.once('focus', () => win.flashFrame(false));
    }
  };

  const announce = (windowId: string | undefined, operation: FinishedOperation) => {
    const target = getWindow(windowId) ?? BrowserWindow.getAllWindows()[0];
    if (!target || target.isDestroyed()) return;
    // Downloads are app-wide: any focused window counts.
    const focused =
      windowId === undefined
        ? BrowserWindow.getFocusedWindow() !== null
        : target.isFocused();
    if (focused) return;
    if (!operation.ok) attention(target);
    if (hub.app.settings.notifications === false || !Notification.isSupported()) return;

    const tu = tm('mainUx');
    const title = TITLES[operation.kind];
    const name =
      windowId === undefined ? undefined : hub.getWindow(windowId)?.fiddle.name;
    const notification = new Notification({
      title: tu(operation.ok ? title.ok : title.failed),
      body: name ? tu('notificationBody', { name }) : '',
    });
    live.add(notification);
    notification.on('click', () => {
      live.delete(notification);
      if (target.isDestroyed()) return;
      if (target.isMinimized()) target.restore();
      target.show();
      target.focus();
    });
    notification.on('close', () => live.delete(notification));
    notification.show();
  };

  let shownRecent: string | undefined;
  const refreshSessionMenus = () => {
    if (process.platform !== 'win32' && process.platform !== 'darwin') return;
    const recent = recentFolders();
    const key = JSON.stringify(recent);
    if (key === shownRecent) return;
    shownRecent = key;
    if (process.platform === 'win32') setJumpList(recent);
    else
      app.dock?.setMenu(Menu.buildFromTemplate(dockMenu(recent, runCommand, openFolder)));
  };

  hub.onChange((change) => {
    if (change.store === 'app') {
      const next = hub.app.versions;
      const done = downloadsFinished(versions, next);
      versions = next;
      if (done) announce(undefined, done);
      for (const windowId of hub.windowIds) showProgress(windowId);
    } else {
      const { windowId } = change;
      const state = hub.getWindow(windowId);
      if (!state) {
        runs.delete(windowId);
        runStarts.delete(windowId);
        shownProgress.delete(windowId);
        return;
      }
      const prev = runs.get(windowId);
      const next = runOf(state);
      const now = Date.now();
      for (const operation of finishedWindowOperations(
        prev,
        next,
        runStarts.get(windowId),
        now,
      )) {
        announce(windowId, operation);
      }
      if (runStarted(prev, next)) runStarts.set(windowId, now);
      else if (next?.status !== 'running') runStarts.delete(windowId);
      runs.set(windowId, next);
      showProgress(windowId);
    }
    // Saving or opening a folder changes the recent list.
    refreshSessionMenus();
  });

  app.on('second-instance', (_event, argv) => {
    // A link's argv is Documents' to handle; a crafted link must not also act as a jump list task.
    if (findDeepLinkInArgv(argv)) return;
    if (argv.includes(ARG_NEW_WINDOW)) runCommand('app.newWindow');
    if (argv.includes(ARG_NEW_FIDDLE)) runCommand('file.newFiddle');
    const dir = jumpListFolder(argv, recentFolders());
    if (dir) openFolder(dir);
  });

  setImmediate(refreshSessionMenus);
}

/**
 * Cold start, once the windows are up: a jump list task's folder
 * (`--fiddle-open-folder`), accepted only as on `second-instance`.
 */
export function openColdStartFolder(argv: readonly string[] = process.argv): void {
  const dir = jumpListFolder(argv, recentFolders());
  if (dir)
    openFolderIn(undefined, dir).catch((error: unknown) =>
      log.error('open recent failed', error),
    );
}

const commandLabel = (id: CommandId): string => t(commands[id].label);

function dockMenu(
  recent: readonly string[],
  runCommand: (id: string) => void,
  openFolder: (dir: string) => void,
): MenuItemConstructorOptions[] {
  const items: MenuItemConstructorOptions[] = [];
  for (const id of ['app.newWindow', 'file.newFiddle'] as const) {
    items.push({ label: commandLabel(id), click: () => runCommand(id) });
  }
  if (recent.length > 0) {
    items.push({ type: 'separator' });
    for (const dir of recent)
      items.push({ label: path.basename(dir), click: () => openFolder(dir) });
  }
  return items;
}

function setJumpList(recent: readonly string[]): void {
  // The list outlives this version, so its entries start the launcher that survives updates.
  const program = appLauncherPath();
  const task = (title: string, args: string, description = title) => ({
    type: 'task' as const,
    title,
    description,
    program,
    args,
    iconPath: program,
    iconIndex: 0,
  });
  const tasks = [
    task(commandLabel('app.newWindow'), ARG_NEW_WINDOW),
    task(commandLabel('file.newFiddle'), ARG_NEW_FIDDLE),
  ];
  const categories: JumpListCategory[] = [{ type: 'tasks', items: tasks }];
  if (recent.length > 0) {
    categories.push({
      type: 'custom',
      name: tm('mainUx')('recent'),
      items: recent.map((dir) => task(path.basename(dir), openFolderArg(dir), dir)),
    });
  }
  const result = app.setJumpList(categories);
  if (result !== 'ok') log.warn('jump list not set', result);
}
