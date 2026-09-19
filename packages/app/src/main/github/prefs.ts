import type { SettingsService } from '../settings/service';
import type { StateHub } from '../state-hub';

export interface PublishOptions {
  asRevision: boolean;
  /** The "Package author" setting, for the gist's package.json. Unset when empty. */
  author?: string;
}

export interface GistPrefs {
  get(): PublishOptions;
  /** Remembers the last visibility choice for the next publish. */
  setVisibility(isPublic: boolean): void;
}

export function createGistPrefs(
  hub: StateHub,
  settings: Pick<SettingsService, 'set'>,
): GistPrefs {
  return {
    get: () => ({
      asRevision: hub.app.settings.gistPublishAsRevision,
      ...(hub.app.settings.packageAuthor
        ? { author: hub.app.settings.packageAuthor }
        : {}),
    }),
    setVisibility: (isPublic) => {
      settings.set('gistVisibility', isPublic ? 'public' : 'secret');
    },
  };
}
