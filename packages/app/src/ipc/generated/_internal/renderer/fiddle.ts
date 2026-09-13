/* eslint-disable */

export * from '../common/fiddle.js';
import type { IAppRenderer } from '../../common/fiddle.js';
export const App = (globalThis as any)['fiddle']?.['App'] as Partial<IAppRenderer> | undefined;
import type { IWindowRenderer } from '../../common/fiddle.js';
export const Window = (globalThis as any)['fiddle']?.['Window'] as Partial<IWindowRenderer> | undefined;