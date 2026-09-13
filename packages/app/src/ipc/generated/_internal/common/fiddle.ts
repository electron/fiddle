/* eslint-disable */

export interface IPCStore<T> {
  getState(): Promise<T>;
  getStateSync(): T;
  onStateChange(fn: (newState: T) => void): () => void;
}
import type { AppState } from "../../../../shared/stores.js";
export type { AppState };
import type { WindowState } from "../../../../shared/stores.js";
export type { WindowState };
export type CommandId = string;
export interface AppInfo {
  name: string;
  version: string;
  electronVersion: string;
}
export interface IAppImpl {
  GetAppInfo(): Promise<AppInfo> | AppInfo;
  getInitialAppState(): Promise<AppState> | AppState;
}
export interface IAppRenderer {
  GetAppInfo(): Promise<AppInfo>;
  AppStore: IPCStore<AppState>
}
export interface IWindowImpl {
  ReportReady(): Promise<void> | void;
  RunCommand(id: CommandId): Promise<void> | void;
  getInitialWindowState(): Promise<WindowState> | WindowState;
}
export interface IWindowRenderer {
  ReportReady(): Promise<void>;
  RunCommand(id: CommandId): Promise<void>;
  onCommand(fn: (id: CommandId) => void): () => void;
  WindowStore: IPCStore<WindowState>
}