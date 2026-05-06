import * as fs from 'node:fs';
import * as path from 'node:path';

import { Octokit } from '@octokit/rest';
import { IpcMainInvokeEvent, app, safeStorage } from 'electron';

import { ipcMainManager } from './ipc';
import { GistRevision } from '../interfaces';
import { IpcEvents } from '../ipc-events';

// --- Input validation ---

const TOKEN_PATTERN =
  /^(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59})$/;

const GIST_ID_PATTERN = /^[0-9a-fA-F]{32}$/;

const SHA_PATTERN = /^[0-9a-f]{40}$/;

const MAX_DESCRIPTION_LENGTH = 256;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per file — GitHub's gist limit

const MAX_FILE_COUNT = 300; // GitHub's gist file limit

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

interface GistFile {
  filename: string;
  content: string;
}

function areValidGistFiles(
  files: unknown,
): files is Record<string, GistFile | null> {
  if (typeof files !== 'object' || files === null || Array.isArray(files))
    return false;

  const entries = Object.entries(files as Record<string, unknown>);

  if (entries.length === 0 || entries.length > MAX_FILE_COUNT) return false;

  for (const [key, value] of entries) {
    // null entries are used to delete files during update
    if (value === null) continue;

    if (typeof value !== 'object') return false;

    const { filename, content } = value as Record<string, unknown>;
    if (typeof filename !== 'string') return false;
    if (filename.length === 0) return false;
    if (filename !== key) return false;
    if (typeof content !== 'string') return false;
    if (content.length > MAX_FILE_SIZE) return false;
  }

  return true;
}

// --- Token storage ---

const CREDENTIALS_FILE = '.github-credentials';

function getCredentialsPath(): string {
  return path.join(app.getPath('userData'), CREDENTIALS_FILE);
}

function saveToken(token: string): void {
  const encrypted = safeStorage.encryptString(token);
  fs.writeFileSync(getCredentialsPath(), encrypted);
}

function loadToken(): string | null {
  const credPath = getCredentialsPath();
  if (!fs.existsSync(credPath)) return null;
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

let octokit: Octokit | null = null;

function getAuthenticatedOctokit(): Octokit {
  if (!octokit) throw new Error('Not authenticated. Please sign in first.');
  return octokit;
}

function getOctokit(): Octokit {
  // Returns an authenticated instance if available, otherwise unauthenticated.
  // Unauthenticated requests have lower rate limits but work for public gists.
  return octokit || new Octokit();
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
    octokit = testOctokit;

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
  octokit = null;
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
    octokit = new Octokit({ auth: token });
    const response = await octokit.users.getAuthenticated();
    return { login: response.data.login };
  } catch {
    // Token is expired or revoked — clean up
    octokit = null;
    deleteToken();
    return { login: null };
  }
}

interface GistWriteResult {
  id: string;
  url: string;
  revision?: string;
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

  const { gistId, files } = params as Record<string, unknown>;

  if (!isValidGistId(gistId)) throw new Error('Invalid gist ID.');
  if (!areValidGistFiles(files)) throw new Error('Invalid files payload.');

  const octo = getAuthenticatedOctokit();

  // Fetch existing files to detect deletions
  const { data: existing } = await octo.gists.get({ gist_id: gistId });
  const updateFiles = { ...(files as Record<string, GistFile | null>) };
  for (const id of Object.keys(existing.files ?? {})) {
    if (!(id in updateFiles)) updateFiles[id] = null as any;
  }

  const gist = await octo.gists.update({
    gist_id: gistId,
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

interface GistLoadResult {
  files: Record<
    string,
    { filename: string; content: string; truncated: boolean; rawUrl?: string }
  >;
  id: string;
  revision?: string;
}

async function handleGistLoad(
  _event: IpcMainInvokeEvent,
  params: unknown,
): Promise<GistLoadResult> {
  if (typeof params !== 'object' || params === null)
    throw new Error('Invalid parameters.');

  const { gistId, revision } = params as Record<string, unknown>;

  if (!isValidGistId(gistId)) throw new Error('Invalid gist ID.');
  if (revision !== undefined && !isValidSha(revision))
    throw new Error('Invalid revision SHA.');

  const octo = getOctokit();
  const gist = revision
    ? await octo.gists.getRevision({ gist_id: gistId, sha: revision })
    : await octo.gists.get({ gist_id: gistId });

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
      truncated: false,
      rawUrl: data.raw_url ?? undefined,
    };
  }

  return {
    files,
    id: gist.data.id!,
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

// --- Setup ---

export function setupGitHub() {
  ipcMainManager.handle(IpcEvents.GITHUB_TOKEN_SIGN_IN, handleTokenSignIn);
  ipcMainManager.handle(IpcEvents.GITHUB_TOKEN_SIGN_OUT, handleTokenSignOut);
  ipcMainManager.handle(
    IpcEvents.GITHUB_TOKEN_CHECK_AUTH,
    handleTokenCheckAuth,
  );
  ipcMainManager.handle(IpcEvents.GITHUB_GIST_CREATE, handleGistCreate);
  ipcMainManager.handle(IpcEvents.GITHUB_GIST_UPDATE, handleGistUpdate);
  ipcMainManager.handle(IpcEvents.GITHUB_GIST_DELETE, handleGistDelete);
  ipcMainManager.handle(IpcEvents.GITHUB_GIST_LOAD, handleGistLoad);
  ipcMainManager.handle(
    IpcEvents.GITHUB_GIST_LIST_COMMITS,
    handleGistListCommits,
  );
}

// Exported for testing
export {
  isValidToken,
  isValidGistId,
  isValidSha,
  isValidDescription,
  areValidGistFiles,
  saveToken,
  loadToken,
  deleteToken,
  handleTokenSignIn,
  handleTokenSignOut,
  handleTokenCheckAuth,
  handleGistCreate,
  handleGistUpdate,
  handleGistDelete,
  handleGistLoad,
  handleGistListCommits,
};
