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
  Documents as GeneratedDocuments,
  Modules as GeneratedModules,
  Onboarding as GeneratedOnboarding,
  Palette as GeneratedPalette,
  type IPaletteRenderer,
  Run as GeneratedRun,
  Versions as GeneratedVersions,
  Window as GeneratedWindow,
  type IRunRenderer,
  type IVersionsRenderer,
  type IAppRenderer,
  type IDocumentsRenderer,
  type IModulesRenderer,
  type IOnboardingRenderer,
  type IWindowRenderer,
} from './generated/renderer/fiddle';
import { Settings as GeneratedSettings, type ISettingsRenderer } from './generated/renderer/fiddle';
import { GitHub as GeneratedGitHub, type IGitHubRenderer } from './generated/renderer/fiddle';
import { AppPlatform as GeneratedAppPlatform, type IAppPlatformRenderer } from './generated/renderer/fiddle';

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
export const documentsApi = bind<IDocumentsRenderer>(GeneratedDocuments, 'Documents');
export type { IDocumentsRenderer } from './generated/renderer/fiddle';
export const modulesApi = bind<IModulesRenderer>(GeneratedModules, 'Modules');
export const onboardingApi = bind<IOnboardingRenderer>(GeneratedOnboarding, 'Onboarding');
export const paletteApi = bind<IPaletteRenderer>(GeneratedPalette, 'Palette');
// Versions and run slice.
export const versionsApi = bind<IVersionsRenderer>(GeneratedVersions, 'Versions');
export const runApi = bind<IRunRenderer>(GeneratedRun, 'Run');
// Settings slice.
export const settingsApi = bind<ISettingsRenderer>(GeneratedSettings, 'Settings');
export type { ISettingsRenderer };
// Gists slice.
export const githubApi = bind<IGitHubRenderer>(GeneratedGitHub, 'GitHub');
// Platform slice: renderer logs, crash reporting and the update toast.
export const appPlatformApi = bind<IAppPlatformRenderer>(GeneratedAppPlatform, 'AppPlatform');
