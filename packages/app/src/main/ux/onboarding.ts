/**
 * Whether to offer the onboarding tour. It's offered on each launch until the
 * user finishes or dismisses it, and only in the first window of a launch.
 * Also whether the first-run crash-reports notice (§14) was shown. Both are
 * kept in state.json (Documents' `getStateStore()`). No Electron imports.
 */
import type { AppStateFile } from '../documents/service';
import type { JsonStore } from '../persistence/json-store';

export function createOnboarding(store: JsonStore<AppStateFile>) {
  let offeredThisLaunch = false;
  return {
    shouldOfferTour(): boolean {
      if (offeredThisLaunch || store.get().tourDone) return false;
      offeredThisLaunch = true;
      return true;
    },

    setTourDone(): void {
      store.set((prev) => ({ ...prev, tourDone: true }));
    },

    /**
     * The first-run notice that crash reports are on (§14). True once, ever,
     * for the first window that asks, and only if `crashReportsOn`. The first
     * call records it either way.
     */
    takeCrashReportsNotice(crashReportsOn: boolean): boolean {
      if (store.get().crashNoticeShown) return false;
      store.set((prev) => ({ ...prev, crashNoticeShown: true }));
      return crashReportsOn;
    },
  };
}
