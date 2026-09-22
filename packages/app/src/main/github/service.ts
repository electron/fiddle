import { rm } from 'node:fs/promises';

import {
  findMainEntry,
  PACKAGE_JSON,
  ensureMainEntry,
  type FileMap,
} from '../../fiddle/files';
import type { GistRevision, GistWriteResult, GitHubClient } from '../../fiddle/github';
import type { VersionRef } from '../../fiddle/fiddle';
import { generatePackageJson } from '../../fiddle/package-json';
import { ErrorCode, FiddleError } from '../../shared/errors';
import {
  getDoc,
  getTemplate,
  markGistDeleted,
  markPublished,
} from '../documents/service';
import { tm } from '../i18n';
import { log } from '../log';
import type { CredentialStorageKind, CredentialStore } from './credentials';

/** `decrypt-failed`: the user was signed out and the file was kept. */
type GitHubNotice = 'decrypt-failed';

interface GistLink {
  id: string;
  url: string;
}

export interface GistFiddle {
  /** Hidden files included. */
  files: FileMap;
  name: string;
  versionRef: VersionRef;
  modules: Readonly<Record<string, string>>;
  source: { gistId?: string; gistRevision?: string };
  /** The files the fiddle held when it was loaded or last saved. An update deletes only remote files with these names. */
  savedNames: string[];
  /** Tells `markPublished` whether the window still holds the fiddle these files came from. */
  loadRev: number;
}

/** The window's fiddle, as publishing reads it. */
function gistFiddle(windowId: string): GistFiddle {
  const { fiddle, baseline, loadRev, name } = getDoc(windowId);
  const { gistId, gistRevision } = fiddle.source;
  return {
    files: { ...fiddle.files },
    name,
    versionRef: fiddle.version,
    modules: fiddle.modules,
    source: { gistId, gistRevision },
    savedNames: Object.keys(baseline),
    loadRev,
  };
}

interface GistHistory {
  id: string;
  /** The revision the window has loaded or last saved. */
  activeSha: string | undefined;
  /** Oldest first. */
  revisions: GistRevision[];
}

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

interface GitHubServiceOptions {
  store: Pick<CredentialStore, 'kind' | 'load' | 'save' | 'delete'>;
  /** The previous app's token file, which sign-out removes too. */
  legacyFile?: string;
  createClient: (token?: string) => GitHubClient;
  prefs: GistPrefs;
  /** Publishes the login name (or undefined when signed out) to the `App` store. */
  setLogin: (login: string | undefined) => void;
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
        log.warn('the stored GitHub token was rejected; signing out', e.code);
        await this.signOut();
      } else {
        log.warn('could not check the GitHub token; keeping it', e.code);
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
      log.error('could not store the GitHub token; keeping it for this session', error);
    }
    this.#setSignedIn(trimmed, login);
    return { login, persisted };
  }

  async signOut(): Promise<void> {
    this.#token = undefined;
    this.#login = undefined;
    this.#options.setLogin(undefined);
    const { legacyFile } = this.#options;
    if (legacyFile) {
      // Otherwise the old token stays valid on disk after the user signed out.
      await rm(legacyFile, { force: true }).catch((error: unknown) =>
        log.warn('could not remove the old GitHub token file', error),
      );
    }
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
    const fiddle = gistFiddle(windowId);
    const { asRevision, author } = this.#options.prefs.get();
    const files = gistFiles(fiddle, author);
    this.#options.prefs.setVisibility(input.isPublic);
    const template = asRevision ? await getTemplate(fiddle.versionRef) : undefined;
    // If the update fails, the gist exists with the template: link it, still unsaved, so Update can finish the job.
    let createdId = '';
    let saved: GistWriteResult;
    try {
      saved = await publishGist(client, input, files, template, (partial) => {
        createdId = partial.id;
        markPublished(windowId, partial, { ...fiddle, files: template ?? {} });
      });
    } catch (error) {
      // `gistId` tells the renderer the gist exists, so it doesn't offer another Publish.
      if (!createdId) throw error;
      const { code, message, details } = FiddleError.from(error);
      throw new FiddleError(code, message, {
        ...(details as Record<string, unknown> | undefined),
        gistId: createdId,
      });
    }
    markPublished(windowId, saved, fiddle);
    return { id: saved.id, url: saved.url };
  }

  /** Remote files the fiddle held and has removed are deleted; any others (a README, images) stay. */
  async update(windowId: string): Promise<GistLink> {
    const client = this.#authedClient();
    const fiddle = gistFiddle(windowId);
    const id = loadedGistId(fiddle);
    const ours = new Set([...fiddle.savedNames, PACKAGE_JSON]);
    const updated = await client.updateGist(id, {
      files: gistFiles(fiddle, this.#options.prefs.get().author),
      canDelete: (name) => ours.has(name),
    });
    markPublished(windowId, updated, fiddle);
    return { id: updated.id, url: updated.url };
  }

  async delete(windowId: string): Promise<void> {
    const client = this.#authedClient();
    const fiddle = gistFiddle(windowId);
    await client.deleteGist(loadedGistId(fiddle));
    markGistDeleted(windowId, fiddle.loadRev);
  }

  /** Works signed out for public gists. */
  async history(windowId: string): Promise<GistHistory> {
    const fiddle = gistFiddle(windowId);
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
  fiddle: Omit<GistFiddle, 'savedNames' | 'loadRev'>,
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
