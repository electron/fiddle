/**
 * The two gist settings, `gistPublishAsRevision` and `gistVisibility`
 * (src/shared/settings.ts). They are read from the `App` store's effective
 * settings and written through the Settings slice, so they persist in
 * settings.json and show up in the Settings page.
 */
import type { SettingsService } from '../settings/service';
import type { StateHub } from '../state-hub';

export interface PublishOptions {
  isPublic: boolean;
  asRevision: boolean;
  /** The "Package author" setting, for the gist's package.json (§17.3). Unset when empty. */
  author?: string;
}

export interface GistPrefs {
  get(): PublishOptions;
  /** Remembers the last visibility choice for the next publish. */
  setVisibility(isPublic: boolean): void;
}

export function createGistPrefs(hub: StateHub, settings: Pick<SettingsService, 'set'>): GistPrefs {
  return {
    get: () => ({
      isPublic: hub.app.settings.gistVisibility === 'public',
      asRevision: hub.app.settings.gistPublishAsRevision,
      ...(hub.app.settings.packageAuthor ? { author: hub.app.settings.packageAuthor } : {}),
    }),
    setVisibility: (isPublic) => {
      settings.set('gistVisibility', isPublic ? 'public' : 'secret');
    },
  };
}
