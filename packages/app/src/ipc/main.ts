/** Bind interfaces through `implement`, so every handler goes through the FiddleError transport. */
import type { WebContents } from 'electron';

import { log } from '../main/log';
import { wrapImplementation } from '../shared/error-transport';

export { App, Window } from './generated/browser/fiddle';
export { Documents } from './generated/browser/fiddle';
export type { IDocumentsImpl } from './generated/common/fiddle';
export type { IAppDispatcher, IWindowDispatcher } from './generated/browser/fiddle';
export type { AppInfo, IAppImpl, IWindowImpl } from './generated/common/fiddle';
export { Settings } from './generated/browser/fiddle';
export { Modules, Onboarding } from './generated/browser/fiddle';
export { GitHub } from './generated/browser/fiddle';
export { Run, Versions } from './generated/browser/fiddle';
export { AppPlatform } from './generated/browser/fiddle';

interface Bindable<Impl, Dispatcher> {
  for(target: WebContents): { setImplementation(impl: Impl): Dispatcher };
}

function logUnexpected(error: unknown): void {
  log.error('unexpected error in an IPC handler', error);
}

export function implement<Impl extends object, Dispatcher>(
  iface: Bindable<Impl, Dispatcher>,
  target: WebContents,
  impl: Impl,
): Dispatcher {
  return iface.for(target).setImplementation(wrapImplementation(impl, logUnexpected));
}
