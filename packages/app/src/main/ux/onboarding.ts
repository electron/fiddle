/**
 * Whether to offer the onboarding tour. It's offered on each launch until the
 * user finishes or dismisses it, and only in the first window of a launch.
 * Persisted in <userData>/onboarding.json.
 */
import path from 'node:path';

import { app } from 'electron';
import { z } from 'zod';

import { createJsonStore, type JsonStore } from '../persistence/json-store';

const schema = z.object({ tourDone: z.boolean() });
type OnboardingState = z.infer<typeof schema>;

let store: JsonStore<OnboardingState> | undefined;
let offeredThisLaunch = false;

function getStore(): JsonStore<OnboardingState> {
  store ??= createJsonStore<OnboardingState>({
    file: path.join(app.getPath('userData'), 'onboarding.json'),
    schema,
    defaults: { tourDone: false },
    version: 1,
  });
  return store;
}

export function shouldOfferTour(): boolean {
  if (offeredThisLaunch || getStore().get().tourDone) return false;
  offeredThisLaunch = true;
  return true;
}

export function setTourDone(): void {
  getStore().set({ tourDone: true });
}
