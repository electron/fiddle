/* eslint-disable */

import { contextBridge, ipcRenderer } from 'electron';
export * from '../common/fiddle.js';
import type { AppState, WindowState, CommandId, AppInfo, IAppImpl, IAppRenderer, IWindowImpl, IWindowRenderer } from '../common/fiddle.js';
import { $eipc_validator$_AppState, $eipc_validator$_WindowState, $eipc_validator$_CommandId, $eipc_validator$_AppInfo } from '../common-runtime/fiddle.js';
const $$ipcPrefix$$ = '$eipc_message$_d56e421f-4e50-b1d2-c5f9-fad47ffcbee5_$_fiddle_$_';
import { webFrame } from "electron/renderer";
function $eipc_event_validator$_MainFrame() {
  let url: URL;
  try {
    url = new URL(window.location.href);
  } catch {
    return false;
  }
  if ((((("frameToken" in webFrame && webFrame.top && "frameToken" in webFrame.top) ? webFrame.top.frameToken === webFrame.frameToken : webFrame.top?.routingId === webFrame.routingId) === true) && ((((url.origin === "null" || url.origin === null ? `${url.protocol}//${url.host}` : url.origin)) === "app://main") || ((true) && ((url.protocol) === "http:") && ((url.hostname) === "localhost"))))) return true;
  return false;
}
export const App: Partial<IAppRenderer> = {
  GetAppInfo() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'App_$_GetAppInfo');
  },
  AppStore: {
    getState(): Promise<AppState> {
      return ipcRenderer.invoke($$ipcPrefix$$ + 'App_$_App_$store$_getState');
    },
    getStateSync(): AppState {
      const response = ipcRenderer.sendSync($$ipcPrefix$$ + 'App_$_App_$store$_getStateSync');
      if (response.error) throw new Error(response.error);
      return response.result;
    },
    onStateChange(fn: (newState: AppState) => void): () => void {
      const handler = (_e: unknown, newState: AppState) => fn(newState);
      const $$channel$$ = $$ipcPrefix$$ + 'App_$_App_$store$_update';
      ipcRenderer.on($$channel$$, handler);
      return () => { ipcRenderer.removeListener($$channel$$, handler); };
    },
  },
}
const $eipc_impl$__init_App = (localBridged: Record<string, any>) => {
  if (!(($eipc_event_validator$_MainFrame()))) return;
  localBridged['fiddle'] = localBridged['fiddle'] || {};
  localBridged['fiddle']['App'] = App
};
export const Window: Partial<IWindowRenderer> = {
  ReportReady() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Window_$_ReportReady');
  },
  RunCommand(id: CommandId) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Window_$_RunCommand', id);
  },
  onCommand(fn: (id: CommandId) => void) {
    const handler = (e: unknown, id: CommandId) => fn(id);
    const $$channel$$ = $$ipcPrefix$$ + 'Window_$_Command';
    ipcRenderer.on($$channel$$, handler)
    return () => { ipcRenderer.removeListener($$channel$$, handler); };
  },
  WindowStore: {
    getState(): Promise<WindowState> {
      return ipcRenderer.invoke($$ipcPrefix$$ + 'Window_$_Window_$store$_getState');
    },
    getStateSync(): WindowState {
      const response = ipcRenderer.sendSync($$ipcPrefix$$ + 'Window_$_Window_$store$_getStateSync');
      if (response.error) throw new Error(response.error);
      return response.result;
    },
    onStateChange(fn: (newState: WindowState) => void): () => void {
      const handler = (_e: unknown, newState: WindowState) => fn(newState);
      const $$channel$$ = $$ipcPrefix$$ + 'Window_$_Window_$store$_update';
      ipcRenderer.on($$channel$$, handler);
      return () => { ipcRenderer.removeListener($$channel$$, handler); };
    },
  },
}
const $eipc_impl$__init_Window = (localBridged: Record<string, any>) => {
  if (!(($eipc_event_validator$_MainFrame()))) return;
  localBridged['fiddle'] = localBridged['fiddle'] || {};
  localBridged['fiddle']['Window'] = Window
};

// Initialize context bridge
const $$bridged$$ = {} as Record<string, any>;
$eipc_impl$__init_App($$bridged$$);
$eipc_impl$__init_Window($$bridged$$);
for (const [key, value] of Object.entries($$bridged$$)) {
  contextBridge.exposeInMainWorld(key, value);
}
