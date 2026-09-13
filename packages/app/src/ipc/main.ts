/**
 * Main-process side of EIPC. Always bind interfaces through `implement`, which
 * wraps every handler with the FiddleError transport: a thrown `FiddleError`
 * reaches the renderer with its code, anything else becomes `internal` and its
 * stack is logged here.
 */
import type { WebContents } from 'electron';

import { wrapImplementation } from '../shared/error-transport';

export { App, Window } from './generated/browser/fiddle';
export type { IAppDispatcher, IWindowDispatcher } from './generated/browser/fiddle';
export type { AppInfo, IAppImpl, IWindowImpl } from './generated/common/fiddle';

interface Bindable<Impl, Dispatcher> {
  for(target: WebContents): { setImplementation(impl: Impl): Dispatcher };
}

function logUnexpected(error: unknown): void {
  console.error('[fiddle] unexpected error in an IPC handler:', error);
}

export function implement<Impl extends object, Dispatcher>(
  iface: Bindable<Impl, Dispatcher>,
  target: WebContents,
  impl: Impl,
): Dispatcher {
  return iface.for(target).setImplementation(wrapImplementation(impl, logUnexpected));
}
