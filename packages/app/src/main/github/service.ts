import {
  findMainEntry,
  PACKAGE_JSON,
  ensureMainEntry,
  type FileMap,
} from '../../fiddle/files';
import type { GistRevision, GistWriteResult, GitHubClient } from '../../fiddle/github';
import { generatePackageJson } from '../../fiddle/package-json';
import { ErrorCode, FiddleError } from '../../shared/errors';
import { tm } from '../i18n';
import type { CredentialStorageKind, CredentialStore } from './credentials';
import type { GistDocuments, GistFiddle } from './documents-bridge';
import type { GistPrefs } from './prefs';

/** `decrypt-failed`: the user was signed out and the file was kept. */
type GitHubNotice = 'decrypt-failed';

interface GistLink {
  id: string;
  url: string;
}

interface GistHistory {
  id: string;
  /** The revision the window has loaded or last saved. */
  activeSha: string | undefined;
  /** Oldest first. */
  revisions: GistRevision[];
}

interface GitHubServiceOptions {
  store: Pick<CredentialStore, 'kind' | 'load' | 'save' | 'delete'>;
  createClient: (token?: string) => GitHubClient;
  documents: GistDocuments;
  prefs: GistPrefs;
  /** Publishes the login name (or undefined when signed out) to the `App` store. */
  setLogin: (login: string | undefined) => void;
  log: { warn(...args: unknown[]): void; error(...args: unknown[]): void };
}

/** A slow answer keeps the token and lets session restore and deep links go on. */
const STARTUP_CHECK_TIMEOUT_MS = 5000;
/** `whenReady` also covers reading the token, which can wait on a keychain prompt. */
const READY_TIMEOUT_MS = 8000;

export class GitHubService {
  readonly #options: GitHubServiceOptions;
  #token: string | undefined;
  #login: string | undefined;
  #notice: GitHubNotice | undefined;
  #init: Promise<void> | undefined;

  constructor(options: GitHubServiceOptions) {
    this.#options = options;
  }

  get login(): string | undefined {
    return this.#login;
  }

  /** Runs once: a 401 or 403 on the stored token deletes it; offline or rate limited keeps it. */
  init(): Promise<void> {
    this.#init ??= this.#restore();
    return this.#init;
  }

  /**
   * Settles once `init` has restored and checked the stored token, at once if
   * it never ran, or after `READY_TIMEOUT_MS`. Session restore and deep links
   * wait for it, so private gists load with the user's token. Never rejects.
   */
  whenReady(): Promise<void> {
    const init = this.#init;
    if (!init) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, READY_TIMEOUT_MS);
      const done = () => {
        clearTimeout(timer);
        resolve();
      };
      init.then(done, done);
    });
  }

  async #restore(): Promise<void> {
    const loaded = await this.#options.store.load();
    if (loaded.kind === 'none') return;
    if (loaded.kind === 'decrypt-failed') {
      this.#notice = 'decrypt-failed';
      return;
    }
    const { token } = loaded.credentials;
    this.#setSignedIn(token, loaded.credentials.login);
    try {
      const user = await this.#options
        .createClient(token)
        .getAuthenticatedUser(AbortSignal.timeout(STARTUP_CHECK_TIMEOUT_MS));
      // Signed in with another token, or out, while the check was running.
      if (this.#token !== token) return;
      if (user.login !== this.#login) this.#setSignedIn(token, user.login);
    } catch (error) {
      if (this.#token !== token) return;
      const e = FiddleError.from(error);
      if (e.code === ErrorCode.unauthorized || e.code === ErrorCode.forbidden) {
        this.#options.log.warn(
          'the stored GitHub token was rejected; signing out',
          e.code,
        );
        await this.signOut();
      } else {
        this.#options.log.warn('could not check the GitHub token; keeping it', e.code);
      }
    }
  }

  credentialStorage(): Promise<CredentialStorageKind> {
    return this.#options.store.kind();
  }

  /** `persisted` is false when the token is kept for this session only. */
  async signIn(
    token: string,
    allowPlaintext: boolean,
  ): Promise<{ login: string; persisted: boolean }> {
    const trimmed = token.trim();
    const login = await this.#options.createClient(trimmed).verifyToken();
    let persisted = false;
    try {
      persisted = await this.#options.store.save(
        { token: trimmed, login },
        { allowPlaintext },
      );
    } catch (error) {
      this.#options.log.error(
        'could not store the GitHub token; keeping it for this session',
        error,
      );
    }
    this.#setSignedIn(trimmed, login);
    return { login, persisted };
  }

  async signOut(): Promise<void> {
    this.#token = undefined;
    this.#login = undefined;
    this.#options.setLogin(undefined);
    await this.#options.store.delete();
  }

  takeNotice(): GitHubNotice | undefined {
    const notice = this.#notice;
    this.#notice = undefined;
    return notice;
  }

  /** With "publish as revision", the gist is created from the template and then updated, so its history shows a diff. */
  async publish(
    windowId: string,
    input: { description: string; isPublic: boolean },
  ): Promise<GistLink> {
    const client = this.#authedClient();
    const fiddle = await this.#options.documents.getFiddle(windowId);
    const { asRevision, author } = this.#options.prefs.get();
    const files = gistFiles(fiddle, author);
    this.#options.prefs.setVisibility(input.isPublic);
    const template = asRevision
      ? await this.#options.documents.getTemplate(windowId)
      : undefined;
    // If the update fails, the gist exists with the template: link it, still unsaved, so Update can finish the job.
    const saved = await publishGist(client, input, files, template, (created) =>
      this.#options.documents.markGistSaved(windowId, created, {
        ...fiddle,
        files: template ?? {},
      }),
    );
    this.#options.documents.markGistSaved(windowId, saved, fiddle);
    return { id: saved.id, url: saved.url };
  }

  /** Remote files the fiddle held and has removed are deleted; any others (a README, images) stay. */
  async update(windowId: string): Promise<GistLink> {
    const client = this.#authedClient();
    const fiddle = await this.#options.documents.getFiddle(windowId);
    const id = loadedGistId(fiddle);
    const ours = new Set([...fiddle.savedNames, PACKAGE_JSON]);
    const updated = await client.updateGist(id, {
      files: gistFiles(fiddle, this.#options.prefs.get().author),
      canDelete: (name) => ours.has(name),
    });
    this.#options.documents.markGistSaved(windowId, updated, fiddle);
    return { id: updated.id, url: updated.url };
  }

  async delete(windowId: string): Promise<void> {
    const client = this.#authedClient();
    const fiddle = await this.#options.documents.getFiddle(windowId);
    await client.deleteGist(loadedGistId(fiddle));
    this.#options.documents.markGistDeleted(windowId);
  }

  /** Works signed out for public gists. */
  async history(windowId: string): Promise<GistHistory> {
    const fiddle = await this.#options.documents.getFiddle(windowId);
    const id = loadedGistId(fiddle);
    const revisions = await this.#options.createClient(this.#token).listGistRevisions(id);
    return {
      id,
      activeSha: fiddle.source.gistRevision ?? revisions.at(-1)?.sha,
      revisions,
    };
  }

  /** A client with the user's token when signed in; used to load private gists. */
  client(): GitHubClient {
    return this.#options.createClient(this.#token);
  }

  #setSignedIn(token: string, login: string): void {
    this.#token = token;
    this.#login = login;
    this.#options.setLogin(login);
  }

  #authedClient(): GitHubClient {
    if (!this.#token) {
      throw new FiddleError(
        ErrorCode.unauthorized,
        tm('mainDocuments')('signInRequired'),
        {
          reason: 'signed-out',
        },
      );
    }
    return this.#options.createClient(this.#token);
  }
}

function loadedGistId(fiddle: GistFiddle): string {
  const id = fiddle.source.gistId;
  if (!id)
    throw new FiddleError(ErrorCode.notFound, 'No gist is loaded in this window', {
      reason: 'no-gist',
    });
  return id;
}

/** The fiddle's files plus a generated package.json. */
export function gistFiles(
  fiddle: Omit<GistFiddle, 'savedNames' | 'fiddleRev'>,
  author?: string,
): FileMap {
  const files = ensureMainEntry(fiddle.files);
  const packageJson = generatePackageJson({
    name: fiddle.name,
    main: findMainEntry(Object.keys(files)),
    ...(author ? { author } : {}),
    modules: fiddle.modules,
    electronVersion:
      fiddle.versionRef.kind === 'release' ? fiddle.versionRef.version : undefined,
  });
  return { ...files, [PACKAGE_JSON]: packageJson };
}

/**
 * Also used by the headless CLI. With a `template`, the gist is created from it
 * and then updated with `files`; if that fails, `onUpdateFailed` gets the gist.
 */
export async function publishGist(
  client: GitHubClient,
  input: { description: string; isPublic: boolean },
  files: FileMap,
  template?: FileMap,
  onUpdateFailed: (created: GistWriteResult) => void = () => {},
): Promise<GistWriteResult> {
  if (!template) return client.createGist({ ...input, files });
  const created = await client.createGist({
    ...input,
    files: { ...template, [PACKAGE_JSON]: files[PACKAGE_JSON]! },
  });
  try {
    return await client.updateGist(created.id, {
      files,
      canDelete: () => true,
      remote: created.files,
    });
  } catch (error) {
    onUpdateFailed(created);
    throw error;
  }
}
