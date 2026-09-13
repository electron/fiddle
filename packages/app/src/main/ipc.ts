/**
 * Binds the EIPC interfaces for one window. Everything is bound with
 * `.for(webContents)` and closes over the window's `windowId`, so renderers
 * never send one. The bindings live on the webContents and survive reloads.
 */
import { app, type WebContents } from 'electron';

import { App, implement, Window } from '../ipc/main';
import { ErrorCode, FiddleError } from '../shared/errors';
import type { CommandRegistry } from './commands';
import { bindDocumentsIpc } from './documents/ipc';
import { bindGitHubIpc } from './github/ipc';
import { bindAppPlatformIpc } from './platform/ipc';
import { bindRunIpc } from './run/ipc';
import { bindSettingsIpc } from './settings/ipc';
import type { StateHub, WindowInit } from './state-hub';
import { bindAppUxIpc } from './ux/ipc';

export interface WindowIpcOptions {
  contents: WebContents;
  windowId: string;
  init: WindowInit;
  hub: StateHub;
  registry: CommandRegistry;
  /** The renderer has read both stores and painted. */
  onReady(): void;
}

export function bindWindowIpc({
  contents,
  windowId,
  init,
  hub,
  registry,
  onReady,
}: WindowIpcOptions): void {
  const appDispatcher = implement(App, contents, {
    getInitialAppState: () => hub.app,
    GetAppInfo: () => ({
      name: app.getName(),
      version: app.getVersion(),
      electronVersion: process.versions.electron,
    }),
  });

  const windowDispatcher = implement(Window, contents, {
    getInitialWindowState: () => {
      const state = hub.getWindow(windowId);
      if (!state) throw new FiddleError(ErrorCode.notFound, `Window ${windowId} is gone`);
      return state;
    },
    ReportReady: () => onReady(),
    RunCommand: (id) => registry.run(id, { windowId }),
  });

  bindDocumentsIpc(contents, windowId);
  bindAppUxIpc({ contents, windowId, hub, registry });
  bindSettingsIpc(contents, windowId);
  bindGitHubIpc(contents, windowId, hub);
  bindAppPlatformIpc(contents);

  bindRunIpc({ contents, windowId, hub });

  // The StateHub is the only caller of update*Store.
  hub.registerWindow(windowId, init, {
    pushApp: (state) => appDispatcher.updateAppStore(state),
    pushWindow: (state) => windowDispatcher.updateWindowStore(state),
  });
}
