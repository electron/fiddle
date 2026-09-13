/**
 * Gist UI state: which gist dialog is open (one at a time, shared by the
 * Publish button, its menu and the gist commands) plus hooks over the stores.
 */
import { useSyncExternalStore } from 'react';

import { useAppStore, useWindowStore } from '../../../ipc/renderer';

export type GistDialog =
  | { kind: 'sign-in'; then?: () => void }
  | { kind: 'publish' }
  | { kind: 'history' }
  | { kind: 'open' };

let current: GistDialog | null = null;
const listeners = new Set<() => void>();

export function showGistDialog(dialog: GistDialog | null): void {
  current = dialog;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useGistDialog(): GistDialog | null {
  return useSyncExternalStore(subscribe, () => current);
}

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
  const app = useAppStore();
  return app.state === 'ready' ? app.result.githubLogin : undefined;
}

/** `gistVisibility` and `gistPublishAsRevision` from the effective settings. */
export function useGistSettings(): { isPublic: boolean; asRevision: boolean } {
  const app = useAppStore();
  const settings = app.state === 'ready' ? app.result.settings : undefined;
  return {
    isPublic: settings?.gistVisibility === 'public',
    asRevision: settings?.gistPublishAsRevision ?? true,
  };
}

export interface LoadedGist {
  id: string;
  revision?: string;
  owner?: string;
}

/** The gist this window's fiddle is linked to, if any. */
export function useLoadedGist(): LoadedGist | undefined {
  const win = useWindowStore();
  if (win.state !== 'ready') return undefined;
  const { gistId, gistRevision, gistOwner } = win.result.fiddle.source;
  return gistId ? { id: gistId, revision: gistRevision, owner: gistOwner } : undefined;
}
