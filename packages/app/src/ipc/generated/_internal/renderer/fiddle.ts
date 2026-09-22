/* eslint-disable */

export * from '../common/fiddle.js';
import type { IAppRenderer } from '../../common/fiddle.js';
export const App = (globalThis as any)['fiddle']?.['App'] as Partial<IAppRenderer> | undefined;
import type { IWindowRenderer } from '../../common/fiddle.js';
export const Window = (globalThis as any)['fiddle']?.['Window'] as Partial<IWindowRenderer> | undefined;
import type { IDocumentsRenderer } from '../../common/fiddle.js';
export const Documents = (globalThis as any)['fiddle']?.['Documents'] as Partial<IDocumentsRenderer> | undefined;
import type { ISettingsRenderer } from '../../common/fiddle.js';
export const Settings = (globalThis as any)['fiddle']?.['Settings'] as Partial<ISettingsRenderer> | undefined;
import type { IModulesRenderer } from '../../common/fiddle.js';
export const Modules = (globalThis as any)['fiddle']?.['Modules'] as Partial<IModulesRenderer> | undefined;
import type { IVersionsRenderer } from '../../common/fiddle.js';
export const Versions = (globalThis as any)['fiddle']?.['Versions'] as Partial<IVersionsRenderer> | undefined;
import type { IRunRenderer } from '../../common/fiddle.js';
export const Run = (globalThis as any)['fiddle']?.['Run'] as Partial<IRunRenderer> | undefined;
import type { IGitHubRenderer } from '../../common/fiddle.js';
export const GitHub = (globalThis as any)['fiddle']?.['GitHub'] as Partial<IGitHubRenderer> | undefined;
import type { IAppPlatformRenderer } from '../../common/fiddle.js';
export const AppPlatform = (globalThis as any)['fiddle']?.['AppPlatform'] as Partial<IAppPlatformRenderer> | undefined;