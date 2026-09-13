/**
 * The two gist settings, `gistPublishAsRevision` and `gistVisibility`
 * (src/shared/settings.ts). They are read from the `App` store's effective
 * settings and written through the Settings slice, so they persist in
 * settings.json and show up in the Settings page.
 */
import { settingsContext } from '../settings';
import type { StateHub } from '../state-hub';

export interface PublishOptions {
  isPublic: boolean;
  asRevision: boolean;
}

export interface GistPrefs {
  get(): PublishOptions;
  /** Remembers the last visibility choice for the next publish. */
  setVisibility(isPublic: boolean): void;
}

export function createGistPrefs(hub: StateHub): GistPrefs {
  return {
    get: () => ({
      isPublic: hub.app.settings.gistVisibility === 'public',
      asRevision: hub.app.settings.gistPublishAsRevision,
    }),
    setVisibility: (isPublic) => {
      settingsContext().service.set('gistVisibility', isPublic ? 'public' : 'secret');
    },
  };
}
