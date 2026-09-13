/**
 * Renderer side of EIPC. Renderer code imports IPC only from here, never from
 * ./generated directly (lint enforces it): these wrappers re-throw errors from
 * main as `FiddleError`s with a stable `code`.
 *
 *   const info = await appApi.GetAppInfo();
 *   const app = useAppStore();        // { state: 'ready', result: AppState } | …
 */
import { ErrorCode, FiddleError } from '../shared/errors';
import { wrapRendererApi } from '../shared/error-transport';
import {
  App as GeneratedApp,
  Window as GeneratedWindow,
  type IAppRenderer,
  type IWindowRenderer,
} from './generated/renderer/fiddle';

export type { AppInfo, IAppRenderer, IWindowRenderer } from './generated/renderer/fiddle';
export {
  useAppStore,
  useWindowStore,
  type AppStoreState,
  type WindowStoreState,
} from './generated/renderer-hooks/fiddle';

function bind<T extends object>(api: Partial<T> | undefined, name: string): T {
  if (api) return wrapRendererApi(api as T);
  // Not exposed (a test, the component gallery, or a foreign origin): fail on use, not on import.
  return new Proxy({} as T, {
    get(_target, property) {
      throw new FiddleError(
        ErrorCode.unavailable,
        `EIPC interface ${name} is not available here (reading ${String(property)})`,
      );
    },
  });
}

export const appApi = bind<IAppRenderer>(GeneratedApp, 'App');
export const windowApi = bind<IWindowRenderer>(GeneratedWindow, 'Window');
