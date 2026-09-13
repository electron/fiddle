/* eslint-disable */

import { appStateSchema } from "../../../../shared/stores.js";
export function $eipc_validator$_AppState(value: unknown) {
  return appStateSchema.safeParse(value).success;
}
import { windowStateSchema } from "../../../../shared/stores.js";
export function $eipc_validator$_WindowState(value: unknown) {
  return windowStateSchema.safeParse(value).success;
}
export function $eipc_validator$_CommandId(value: any): boolean {
if (typeof value !== 'string') return false;
if (!(value.length >= 1)) return false;
if (!(value.length <= 100)) return false;
  return true;
}
export function $eipc_validator$_AppInfo(value: any): boolean {
  if (!value || typeof value !== 'object') return false;

  // AppInfo.name
  if (!(typeof value.name === 'string')) return false;

  // AppInfo.version
  if (!(typeof value.version === 'string')) return false;

  // AppInfo.electronVersion
  if (!(typeof value.electronVersion === 'string')) return false;
  return true;
}