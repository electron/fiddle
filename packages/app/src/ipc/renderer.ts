/** Renderer code imports IPC only from here (lint enforces it): these wrappers re-throw errors from main as `FiddleError`s. */
import { ErrorCode, FiddleError } from '../shared/errors';
import { wrapRendererApi } from '../shared/error-transport';
import {
  App as GeneratedApp,
  AppPlatform as GeneratedAppPlatform,
  Documents as GeneratedDocuments,
  GitHub as GeneratedGitHub,
  Modules as GeneratedModules,
  Run as GeneratedRun,
  Settings as GeneratedSettings,
  Versions as GeneratedVersions,
  Window as GeneratedWindow,
  type IAppPlatformRenderer,
  type IAppRenderer,
  type IDocumentsRenderer,
  type IGitHubRenderer,
  type IModulesRenderer,
  type IRunRenderer,
  type ISettingsRenderer,
  type IVersionsRenderer,
  type IWindowRenderer,
} from './generated/renderer/fiddle';

export type { IAppRenderer, IWindowRenderer } from './generated/renderer/fiddle';
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
export const documentsApi = bind<IDocumentsRenderer>(GeneratedDocuments, 'Documents');
export type { IDocumentsRenderer } from './generated/renderer/fiddle';
export const modulesApi = bind<IModulesRenderer>(GeneratedModules, 'Modules');
export const versionsApi = bind<IVersionsRenderer>(GeneratedVersions, 'Versions');
export const runApi = bind<IRunRenderer>(GeneratedRun, 'Run');
export const settingsApi = bind<ISettingsRenderer>(GeneratedSettings, 'Settings');
export type { ISettingsRenderer };
export const githubApi = bind<IGitHubRenderer>(GeneratedGitHub, 'GitHub');
export const appPlatformApi = bind<IAppPlatformRenderer>(
  GeneratedAppPlatform,
  'AppPlatform',
);
