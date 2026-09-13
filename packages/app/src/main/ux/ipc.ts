/** Binds `Onboarding` (the tour) for one window. */
import { implement, Onboarding } from '../../ipc/main';
import type { IpcContext } from '../ipc';

export function bindOnboardingIpc({ contents, services: { onboarding } }: IpcContext): void {
  implement(Onboarding, contents, {
    ShouldOfferTour: () => onboarding.shouldOfferTour(),
    SetTourDone: () => onboarding.setTourDone(),
  });
}
