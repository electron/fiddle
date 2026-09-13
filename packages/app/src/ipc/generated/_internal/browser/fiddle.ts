/* eslint-disable */

import { app as $$app$$ } from 'electron';
export * from '../common/fiddle.js';
import type { AppState, WindowState, CommandId, AppInfo, IAppImpl, IAppRenderer, IWindowImpl, IWindowRenderer } from '../common/fiddle.js';
import { $eipc_validator$_AppState, $eipc_validator$_WindowState, $eipc_validator$_CommandId, $eipc_validator$_AppInfo } from '../common-runtime/fiddle.js';
import * as $eipc$ from '../browser-runtime.js';
const $$ipcPrefix$$ = '$eipc_message$_d56e421f-4e50-b1d2-c5f9-fad47ffcbee5_$_fiddle_$_';
// Interfaces are declared as data and wired up by ../browser-runtime.ts:
//   methods: [name, [[argName, validator], ...], resultValidator?]  ([Sync] methods append null|validator, 'sync')
//   stores:  [name, stateValidator]
//   events:  [name, [[argName, validator], ...]]
function $eipc_event_validator$_MainFrame(event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) {
  if (!event.senderFrame) return false;
  if (!event.senderFrame.url) return false;
  let url: URL;
  try {
    url = new URL(event.senderFrame.url);
  } catch {
    return false;
  }
  if ((((event.senderFrame?.parent === null) === true) && ((((url.origin === "null" || url.origin === null ? `${url.protocol}//${url.host}` : url.origin)) === "app://main") || ((($$app$$.isPackaged) === false) && ((url.protocol) === "http:") && ((url.hostname) === "localhost"))))) return true;
  return false;
}
export interface IAppDispatcher {
  updateAppStore(state: AppState): void;
}
export const App = /*#__PURE__*/ $eipc$.defineInterface<IAppImpl, IAppRenderer, IAppDispatcher>($$ipcPrefix$$, 'App', $eipc_event_validator$_MainFrame, {
  methods: [
    ['GetAppInfo', [], $eipc_validator$_AppInfo],
  ],
  stores: [
    ['App', $eipc_validator$_AppState],
  ],
});
export interface IWindowDispatcher {
  dispatchCommand(arg_id: CommandId): void;
  updateWindowStore(state: WindowState): void;
}
export const Window = /*#__PURE__*/ $eipc$.defineInterface<IWindowImpl, IWindowRenderer, IWindowDispatcher>($$ipcPrefix$$, 'Window', $eipc_event_validator$_MainFrame, {
  methods: [
    ['ReportReady', []],
    ['RunCommand', [['id', $eipc_validator$_CommandId]]],
  ],
  stores: [
    ['Window', $eipc_validator$_WindowState],
  ],
  events: [
    ['Command', [['id', $eipc_validator$_CommandId]]],
  ],
});