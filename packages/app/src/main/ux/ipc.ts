/**
 * App UX slice: binds `Modules`, `Onboarding` and `Palette` for a window, and
 * installs OS integration once.
 */
import type { WebContents } from 'electron';

import { SHOW_ME_EXAMPLES } from '../../fiddle/examples';
import { implement, Onboarding, Palette } from '../../ipc/main';
import type { CommandRegistry } from '../commands';
import { bindModulesIpc } from '../modules/ipc';
import type { StateHub } from '../state-hub';
import { installOsIntegration } from './integration';
import { setTourDone, shouldOfferTour } from './onboarding';

export interface AppUxIpcOptions {
  contents: WebContents;
  windowId: string;
  hub: StateHub;
  registry: CommandRegistry;
}

export function bindAppUxIpc({ contents, windowId, hub, registry }: AppUxIpcOptions): void {
  bindModulesIpc(contents, windowId, hub);
  implement(Onboarding, contents, {
    ShouldOfferTour: () => shouldOfferTour(),
    SetTourDone: () => setTourDone(),
  });
  implement(Palette, contents, {
    GetShowMeExamples: () => [...SHOW_ME_EXAMPLES],
  });
  installOsIntegration(hub, registry);
}
