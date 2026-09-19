import type { AppStateFile } from '../documents/service';
import type { JsonStore } from '../persistence/json-store';
import { testFlags } from '../test-mode';

export function createOnboarding(store: JsonStore<AppStateFile>) {
  let offeredThisLaunch = false;
  return {
    shouldOfferTour(): boolean {
      if (!testFlags().tour || offeredThisLaunch || store.get().tourDone) return false;
      offeredThisLaunch = true;
      return true;
    },

    setTourDone(): void {
      store.set((prev) => ({ ...prev, tourDone: true }));
    },

    /** True once, ever, and only if `crashReportsOn`: the first call records the notice either way. */
    takeCrashReportsNotice(crashReportsOn: boolean): boolean {
      if (store.get().crashNoticeShown) return false;
      store.set((prev) => ({ ...prev, crashNoticeShown: true }));
      return crashReportsOn;
    },
  };
}
