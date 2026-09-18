import { BrowserWindow, clipboard } from 'electron';

import { asGistReference, gistUrl, isGistId } from '../../fiddle/gist-id';
import { isValidTokenFormat } from '../../fiddle/github';
import { GitHubCredentialStorage } from '../../ipc/generated/common/fiddle';
import { GitHub, implement } from '../../ipc/main';
import { ErrorCode, FiddleError } from '../../shared/errors';
import type { IpcContext } from '../ipc';
import { openExternalLink } from '../security';

/** GitHub's new-token page with the `gist` scope prefilled. */
const NEW_TOKEN_URL =
  'https://github.com/settings/tokens/new?scopes=gist&description=Electron%20Fiddle';

const storageKinds = {
  encrypted: GitHubCredentialStorage.Encrypted,
  weak: GitHubCredentialStorage.Weak,
  unavailable: GitHubCredentialStorage.Unavailable,
} as const;

export function bindGitHubIpc({
  contents,
  windowId,
  services: { github },
}: IpcContext): void {
  implement(GitHub, contents, {
    GetCredentialStorage: async () => storageKinds[await github.credentialStorage()],
    SignIn: (token, allowPlaintext) => github.signIn(token, allowPlaintext),
    SignOut: () => github.signOut(),
    // Main reads the clipboard itself, so a token there never reaches the renderer.
    SignInFromClipboard: async (allowPlaintext) => {
      const token = (await clipboard.readText()).trim();
      if (!isValidTokenFormat(token)) {
        throw new FiddleError(
          ErrorCode.invalidArgument,
          'There is no token on the clipboard',
          { reason: 'bad-format' },
        );
      }
      return github.signIn(token, allowPlaintext);
    },
    HasClipboardToken: async () =>
      isValidTokenFormat((await clipboard.readText()).trim()),
    // Only a gist URL or ID comes back, so the renderer can't read anything else off the clipboard.
    ReadClipboardGist: async () => asGistReference(await clipboard.readText()),
    OpenNewTokenPage: () =>
      openExternalLink(
        NEW_TOKEN_URL,
        BrowserWindow.fromWebContents(contents) ?? undefined,
      ),
    TakeNotice: () => github.takeNotice() ?? null,
    Publish: (description, isPublic) =>
      github.publish(windowId, { description, isPublic }),
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
      if (!isGistId(id))
        throw new FiddleError(ErrorCode.invalidArgument, 'Invalid gist ID');
      clipboard.writeText(gistUrl(id));
    },
  });
}
