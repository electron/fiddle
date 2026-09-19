/**
 * Binds the EIPC interfaces for one window, each closing over its `windowId` so
 * renderers never send one. The bindings live on the webContents and survive reloads.
 */
import { app, type WebContents } from 'electron';

import { App, implement, Window } from '../ipc/main';
import { ErrorCode, FiddleError } from '../shared/errors';
import { reportContextMenu } from './context-menu';
import { activateWindowMenuItem } from './menu';
import { bindDocumentsIpc } from './documents/ipc';
import { bindGitHubIpc } from './github/ipc';
import { bindModulesIpc } from './modules/ipc';
import { bindAppPlatformIpc } from './platform/ipc';
import { bindRunIpc } from './run/ipc';
import type { Services } from './services';
import { bindSettingsIpc } from './settings/ipc';
import type { WindowInit } from './state-hub';
import { titleBarDoubleClick } from './title-bar';
import { bindOnboardingIpc } from './ux/ipc';
import { getWindow } from './windows';

export interface IpcContext {
  contents: WebContents;
  windowId: string;
  services: Services;
}

/** `onReady`: the renderer has read both stores and painted. */
export function bindWindowIpc(
  ctx: IpcContext,
  init: WindowInit,
  onReady: () => void,
): void {
  const { contents, windowId, services } = ctx;
  const { hub, registry } = services;
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
    DoubleClickTitleBar: () => titleBarDoubleClick(getWindow(windowId)),
    ReportContextMenu: (context) => reportContextMenu(windowId, context),
    ActivateMenuItem: (id) => activateWindowMenuItem(windowId, id),
  });

  bindDocumentsIpc(ctx);
  bindModulesIpc(ctx);
  bindOnboardingIpc(ctx);
  bindSettingsIpc(ctx);
  bindGitHubIpc(ctx);
  bindAppPlatformIpc(ctx);
  bindRunIpc(ctx);

  hub.registerWindow(windowId, init, {
    pushApp: (state) => appDispatcher.updateAppStore(state),
    pushWindow: (state) => windowDispatcher.updateWindowStore(state),
  });
}
