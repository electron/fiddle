/**
 * Gist UI state: which gist dialog is open (one at a time, shared by the
 * Publish button, its menu and the gist commands) plus hooks over the stores.
 */
import { useAppState, useWindowState } from '../../state';
import { createStore, useStore } from '../../store';

export type GistDialog =
  | { kind: 'sign-in'; then?: () => void }
  | { kind: 'publish' }
  | { kind: 'history' }
  | { kind: 'open' };

const dialogStore = createStore<GistDialog | null>(null);

export const showGistDialog = dialogStore.set;

/** Closes `dialog` only if it is still the open one, so a late close can't dismiss its replacement. */
export function closeGistDialog(dialog: GistDialog): void {
  if (dialogStore.get() === dialog) showGistDialog(null);
}

export const useGistDialog = (): GistDialog | null => useStore(dialogStore);

/** Runs `action` now when signed in, otherwise once the sign-in dialog succeeds. */
export function withSignIn(login: string | undefined, action: () => void): void {
  if (login) action();
  else showGistDialog({ kind: 'sign-in', then: action });
}

export function requestPublish(login: string | undefined): void {
  withSignIn(login, () => showGistDialog({ kind: 'publish' }));
}

/** The signed-in GitHub login, if any. The token never reaches the renderer. */
export function useGitHubLogin(): string | undefined {
  return useAppState()?.githubLogin;
}

export function useGistSettings(): { isPublic: boolean; showHistory: boolean } {
  const settings = useAppState()?.settings;
  return {
    isPublic: settings?.gistVisibility === 'public',
    showHistory: settings?.gistShowHistory ?? true,
  };
}

export interface LoadedGist {
  id: string;
  revision?: string;
  owner?: string;
}

export function useLoadedGist(): LoadedGist | undefined {
  const win = useWindowState();
  if (!win) return undefined;
  const { gistId, gistRevision, gistOwner } = win.fiddle.source;
  return gistId ? { id: gistId, revision: gistRevision, owner: gistOwner } : undefined;
}
