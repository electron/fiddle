import * as fs from 'node:fs';
import { join as pathJoin } from 'node:path';

import { Octokit, RestEndpointMethodTypes } from '@octokit/rest';
import { IpcMainInvokeEvent, app, safeStorage } from 'electron';

import { getTemplate } from './content';
import { ipcMainManager } from './ipc';
import { GIST_MAX_FILE_COUNT, GIST_MAX_FILE_SIZE } from '../constants';
import { EditorValues, GistFile, GistLoadResult, GistRevision, GistWriteResult } from '../interfaces';
import { IpcEvents } from '../ipc-events';
import { isSupportedFile } from '../utils/editor-utils';

// --- Input validation ---

const ELECTRON_ORG = 'electron';

const ELECTRON_REPO = 'electron';

const TOKEN_PATTERN =
  /^(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59})$/;

const GIST_ID_PATTERN = /^[0-9a-fA-F]{32}$/;

const SHA_PATTERN = /^[0-9a-f]{40}$/;

const MAX_DESCRIPTION_LENGTH = 256;

function isValidToken(token: unknown): token is string {
  return typeof token === 'string' && TOKEN_PATTERN.test(token);
}

function isValidGistId(gistId: unknown): gistId is string {
  return typeof gistId === 'string' && GIST_ID_PATTERN.test(gistId);
}

function isValidSha(sha: unknown): sha is string {
  return typeof sha === 'string' && SHA_PATTERN.test(sha);
}

function isValidDescription(description: unknown): description is string {
  return (
    typeof description === 'string' &&
    description.length > 0 &&
    description.length <= MAX_DESCRIPTION_LENGTH
  );
}

function areValidGistFiles(
  files: unknown,
): files is Record<string, GistFile | null> {
  if (typeof files !== 'object' || files === null || Array.isArray(files))
    return false;

  const entries = Object.entries(files as Record<string, unknown>);

  if (entries.length === 0 || entries.length > GIST_MAX_FILE_COUNT)
    return false;

  for (const [key, value] of entries) {
    // null entries are used to delete files during update
    if (value === null) continue;

    if (typeof value !== 'object') return false;

    const { filename, content } = value as Record<string, unknown>;
    if (typeof filename !== 'string') return false;
    if (filename.length === 0) return false;
    if (filename !== key) return false;
    if (typeof content !== 'string') return false;
    if (content.length > GIST_MAX_FILE_SIZE) return false;
  }

  return true;
}

// --- Token storage ---

function getCredentialsPath(): string {
  const CREDENTIALS_FILE = '.github-credentials';
  return pathJoin(app.getPath('userData'), CREDENTIALS_FILE);
}

function saveToken(token: string): void {
  const encrypted = safeStorage.encryptString(token);
  fs.writeFileSync(getCredentialsPath(), encrypted, { mode: 0o600 });
}

function loadToken(): string | null {
  const credPath = getCredentialsPath();
  try {
    const encrypted = fs.readFileSync(credPath);
    return safeStorage.decryptString(encrypted);
  } catch {
    return null;
  }
}

function deleteToken(): void {
  const credPath = getCredentialsPath();
  if (fs.existsSync(credPath)) fs.unlinkSync(credPath);
}

// --- Octokit management ---

let octokit_: Octokit | null = null;

function getAuthenticatedOctokit(): Octokit {
  if (!octokit_) throw new Error('Not authenticated. Please sign in first.');
  return octokit_;
}

function getOctokit(): Octokit {
  // Returns an authenticated instance if available, otherwise unauthenticated.
  // Unauthenticated requests have lower rate limits but work for public gists.
  return octokit_ || new Octokit();
}

// --- IPC handlers ---

interface SignInResult {
  success: boolean;
  login?: string;
  error?: string;
}

async function handleTokenSignIn(
  _event: IpcMainInvokeEvent,
  token: unknown,
): Promise<SignInResult> {
  if (!isValidToken(token))
    return { success: false, error: 'Invalid token format.' };

  if (!safeStorage.isEncryptionAvailable()) {
    return {
      success: false,
      error:
        'Encryption is not available on this system. Cannot securely store token.',
    };
  }

  try {
    const testOctokit = new Octokit({ auth: token });
    const response = await testOctokit.users.getAuthenticated();

    const scopes = response.headers['x-oauth-scopes']?.split(', ') || [];
    if (!scopes.includes('gist'))
      return {
        success: false,
        error:
          'Token is missing the "gist" scope. Please generate a new token with gist permissions.',
      };

    saveToken(token);
    octokit_ = testOctokit;

    return { success: true, login: response.data.login };
  } catch (error: any) {
    return {
      success: false,
      error: 'Invalid GitHub token. Please check your token and try again.',
    };
  }
}

async function handleTokenSignOut(
  _event: IpcMainInvokeEvent,
): Promise<{ success: boolean }> {
  deleteToken();
  octokit_ = null;
  return { success: true };
}

interface CheckAuthResult {
  login: string | null;
}

async function handleTokenCheckAuth(
  _event: IpcMainInvokeEvent,
): Promise<CheckAuthResult> {
  const token = loadToken();
  if (!token) return { login: null };

  try {
    octokit_ = new Octokit({ auth: token });
    const response = await octokit_.users.getAuthenticated();
    return { login: response.data.login };
  } catch (error: any) {
    octokit_ = null;

    if (error?.status === 401 || error?.status === 403) {
      deleteToken();
    }

    return { login: null };
  }
}

async function handleGistCreate(
  _event: IpcMainInvokeEvent,
  params: unknown,
): Promise<GistWriteResult> {
  if (typeof params !== 'object' || params === null)
    throw new Error('Invalid parameters.');

  const { description, files, isPublic } = params as Record<string, unknown>;

  if (!isValidDescription(description))
    throw new Error(
      `Invalid description. Must be 1-${MAX_DESCRIPTION_LENGTH} characters.`,
    );
  if (!areValidGistFiles(files)) throw new Error('Invalid files payload.');
  if (typeof isPublic !== 'boolean')
    throw new Error('isPublic must be a boolean.');

  const octo = getAuthenticatedOctokit();
  const gist = await octo.gists.create({
    public: isPublic,
    description,
    files: files as any,
  });

  return {
    id: gist.data.id!,
    url: gist.data.html_url ?? '',
    revision: gist.data.history?.[0]?.version,
  };
}

async function handleGistUpdate(
  _event: IpcMainInvokeEvent,
  params: unknown,
): Promise<GistWriteResult> {
  if (typeof params !== 'object' || params === null)
    throw new Error('Invalid parameters.');

  const { id, files } = params as Record<string, unknown>;

  if (!isValidGistId(id)) throw new Error('Invalid gist ID.');
  if (!areValidGistFiles(files)) throw new Error('Invalid files payload.');

  const octo = getAuthenticatedOctokit();

  // Fetch existing files to detect deletions
  const { data: existing } = await octo.gists.get({ gist_id: id });
  const updateFiles = { ...(files as Record<string, GistFile | null>) };
  for (const fileId of Object.keys(existing.files ?? {})) {
    if (!(fileId in updateFiles)) updateFiles[fileId] = null as any;
  }

  const gist = await octo.gists.update({
    gist_id: id,
    files: updateFiles as any,
  });

  return {
    id: gist.data.id!,
    url: gist.data.html_url ?? '',
    revision: gist.data.history?.[0]?.version,
  };
}

async function handleGistDelete(
  _event: IpcMainInvokeEvent,
  gistId: unknown,
): Promise<{ success: boolean }> {
  if (!isValidGistId(gistId)) throw new Error('Invalid gist ID.');

  const octo = getAuthenticatedOctokit();
  await octo.gists.delete({ gist_id: gistId });
  return { success: true };
}

async function handleGistLoad(
  _event: IpcMainInvokeEvent,
  params: unknown,
): Promise<GistLoadResult> {
  if (typeof params !== 'object' || params === null)
    throw new Error('Invalid parameters.');

  const { id, revision } = params as Record<string, unknown>;

  if (!isValidGistId(id)) throw new Error('Invalid gist ID.');
  if (revision !== undefined && !isValidSha(revision))
    throw new Error('Invalid revision SHA.');

  const octo = getOctokit();
  const gist = revision
    ? await octo.gists.getRevision({ gist_id: id, sha: revision })
    : await octo.gists.get({ gist_id: id });

  const files: GistLoadResult['files'] = {};
  for (const [id, data] of Object.entries(gist.data.files ?? {})) {
    if (!data) continue;

    // When GitHub truncates a large file, data.content is incomplete.
    // Fetch the full content from raw_url instead.
    let content = data.content ?? '';
    if (data.truncated && data.raw_url) {
      const response = await fetch(data.raw_url);
      if (response.ok) {
        content = await response.text();
      }
    }

    files[id] = {
      filename: data.filename ?? id,
      content,
    };
  }

  return {
    files,
    revision: gist.data.history?.[0]?.version,
  };
}

async function handleGistListCommits(
  _event: IpcMainInvokeEvent,
  gistId: unknown,
): Promise<GistRevision[]> {
  if (!isValidGistId(gistId)) throw new Error('Invalid gist ID.');

  const octo = getOctokit();
  const { data: revisions } = await octo.gists.listCommits({
    gist_id: gistId,
  });

  const oldestRevision = revisions[revisions.length - 1];
  const nonEmptyRevisions = revisions.filter(
    (r) =>
      r === oldestRevision ||
      (r.change_status.additions ?? 0) > 0 ||
      (r.change_status.deletions ?? 0) > 0,
  );

  return nonEmptyRevisions.reverse().map((r, i) => ({
    sha: r.version,
    date: r.committed_at,
    changes: {
      total: r.change_status.total ?? 0,
      additions: r.change_status.additions ?? 0,
      deletions: r.change_status.deletions ?? 0,
    },
    title: i === 0 ? 'Created' : `Revision ${i}`,
  }));
}

async function handleFetchExample(
  _event: IpcMainInvokeEvent,
  params: unknown,
): Promise<EditorValues> {
  if (typeof params !== 'object' || params === null)
    throw new Error('Invalid parameters.');
  const { ref, path } = params as Record<string, unknown>;
  if (typeof ref !== 'string') throw new Error('Invalid ref.');
  if (typeof path !== 'string') throw new Error('Invalid path.');
  return fetchExample(ref, path);
}

async function fetchExample(ref: string, path: string): Promise<EditorValues> {
  if (!ref) throw new Error('Invalid ref.');
  if (!path) throw new Error('Invalid path.');

  // `repos.getContent` returns a union; the directory variant is the array form.
  type RepoContentEntry = Extract<
    RestEndpointMethodTypes['repos']['getContent']['response']['data'],
    readonly unknown[]
  >[number];

  const owner = ELECTRON_ORG;
  const repo = ELECTRON_REPO;
  const octo = getOctokit();

  // Fetch the example folder listing.
  const folder = await octo.repos.getContent({ owner, path, ref, repo });
  if (!Array.isArray(folder.data))
    throw new Error(`${owner}:${repo}/${path}:${ref} is not a valid example`);
  const files = (folder.data as RepoContentEntry[]).filter(
    (file) =>
      typeof file.download_url === 'string' &&
      typeof file.name === 'string' &&
      isSupportedFile(file.name),
  );

  // Get the base template for this version: 'v42.0.0' -> '42.0.0'.
  const version = ref.replace(/^v/, '');
  const values: EditorValues = { ...(await getTemplate(version)) };

  // Download each supported file and overlay onto the template.
  await Promise.all(
    files.map(async (file) => {
      const resp = await fetch(file.download_url as string);
      if (!resp.ok)
        throw new Error(`Failed to download ${file.name}: ${resp.status}`);
      values[file.name as keyof EditorValues] = await resp.text();
    }),
  );

  return values;
}

// --- Setup ---

export function setupGitHub() {
  ipcMainManager.handle(IpcEvents.GITHUB_FETCH_EXAMPLE, handleFetchExample);
  ipcMainManager.handle(IpcEvents.GITHUB_GIST_CREATE, handleGistCreate);
  ipcMainManager.handle(IpcEvents.GITHUB_GIST_DELETE, handleGistDelete);
  ipcMainManager.handle(
    IpcEvents.GITHUB_GIST_LIST_COMMITS,
    handleGistListCommits,
  );
  ipcMainManager.handle(IpcEvents.GITHUB_GIST_LOAD, handleGistLoad);
  ipcMainManager.handle(IpcEvents.GITHUB_GIST_UPDATE, handleGistUpdate);
  ipcMainManager.handle(
    IpcEvents.GITHUB_TOKEN_CHECK_AUTH,
    handleTokenCheckAuth,
  );
  ipcMainManager.handle(IpcEvents.GITHUB_TOKEN_SIGN_IN, handleTokenSignIn);
  ipcMainManager.handle(IpcEvents.GITHUB_TOKEN_SIGN_OUT, handleTokenSignOut);
}

// Exported for testing
export const testing = {
  fetchExample,
  getCredentialsPath,
  handleGistCreate,
  handleGistDelete,
  handleGistListCommits,
  handleGistLoad,
  handleGistUpdate,
  handleTokenCheckAuth,
  handleTokenSignIn,
  handleTokenSignOut,
  loadToken,
  saveToken,
};
