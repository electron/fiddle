/**
 * Binds `interface GitHub` for one window and owns the one GitHubService.
 * The service is created with the first window, which also runs the startup
 * token check; the token stays in this process.
 */
import path from 'node:path';

import { app, clipboard, safeStorage, shell, type WebContents } from 'electron';

import { isGistId } from '../../fiddle/gist-id';
import { GitHubClient, isValidTokenFormat } from '../../fiddle/github';
import { GistDialogKind, GitHubCredentialStorage } from '../../ipc/generated/common/fiddle';
import { GitHub, implement, type IGitHubDispatcher } from '../../ipc/main';
import { ErrorCode, FiddleError } from '../../shared/errors';
import { setDocumentHooks } from '../documents/service';
import { log } from '../log';
import type { StateHub } from '../state-hub';
import { getEndpoints } from '../test-mode';
import { CredentialStore } from './credentials';
import { createDocumentsBridge } from './documents-bridge';
import { createGistPrefs } from './prefs';
import { GitHubService } from './service';

/** GitHub's new-token page with the `gist` scope prefilled. */
export const NEW_TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=Electron%20Fiddle';

const dialogKinds = {
  publish: GistDialogKind.Publish,
  open: GistDialogKind.Open,
  history: GistDialogKind.History,
} as const;

const storageKinds = {
  encrypted: GitHubCredentialStorage.Encrypted,
  weak: GitHubCredentialStorage.Weak,
  unavailable: GitHubCredentialStorage.Unavailable,
} as const;

let service: GitHubService | undefined;
const dispatchers = new Map<string, IGitHubDispatcher>();

function getService(hub: StateHub): GitHubService {
  if (service) return service;
  const created = new GitHubService({
    store: new CredentialStore({
      file: path.join(app.getPath('userData'), 'credentials', 'github'),
      safeStorage,
      platform: process.platform,
    }),
    createClient: (token) => {
      const endpoints = getEndpoints();
      return new GitHubClient({ token, apiBaseUrl: endpoints.githubApi, rawOrigins: [endpoints.gistRaw] });
    },
    documents: createDocumentsBridge(hub),
    prefs: createGistPrefs(hub),
    setLogin: (githubLogin) => hub.updateApp({ githubLogin }),
    log,
  });
  service = created;
  // Documents loads gists with the signed-in token, so private gists work.
  setDocumentHooks({ github: () => created.client() });
  created.init().catch((error: unknown) => log.error('GitHub startup check failed', error));
  return created;
}

/** Asks a window to open a gist dialog (used by the gist commands). */
export function openGistDialog(windowId: string | undefined, kind: keyof typeof dialogKinds): void {
  if (windowId) dispatchers.get(windowId)?.dispatchOpenDialog(dialogKinds[kind]);
}

export function bindGitHubIpc(contents: WebContents, windowId: string, hub: StateHub): void {
  const github = getService(hub);
  const dispatcher = implement(GitHub, contents, {
    GetCredentialStorage: async () => storageKinds[await github.credentialStorage()],
    SignIn: (token, allowPlaintext) => github.signIn(token, allowPlaintext),
    SignOut: () => github.signOut(),
    ReadClipboardToken: async () => {
      const text = (await clipboard.readText()).trim();
      return isValidTokenFormat(text) ? text : null;
    },
    OpenNewTokenPage: () => shell.openExternal(NEW_TOKEN_URL),
    TakeNotice: () => github.takeNotice() ?? null,
    Publish: (description, isPublic) => github.publish(windowId, { description, isPublic }),
    Update: () => github.update(windowId),
    Delete: () => github.delete(windowId),
    GetHistory: async () => {
      const history = await github.history(windowId);
      return {
        id: history.id,
        activeSha: history.activeSha,
        revisions: history.revisions.map((r) => ({
          sha: r.sha,
          date: r.date,
          additions: r.additions,
          deletions: r.deletions,
          n: r.title.key === 'created' ? 0 : r.title.n,
        })),
      };
    },
    CopyShareLink: (id) => {
      if (!isGistId(id)) throw new FiddleError(ErrorCode.invalidArgument, 'Invalid gist ID');
      clipboard.writeText(github.shareLink(id));
    },
  });
  dispatchers.set(windowId, dispatcher);
  contents.once('destroyed', () => dispatchers.delete(windowId));
}
