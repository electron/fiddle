import { z } from 'zod';

import { ErrorCode, FiddleError } from '../shared/errors';
import { reasonError } from './error-reasons';
import type { FileMap } from './files';
import { gistUrl, isGistId, isRevisionSha } from './gist-id';
import { type FiddleOrigin, gistOrigin } from './trust';

export const GITHUB_API_URL = 'https://api.github.com';
export const GIST_RAW_ORIGIN = 'https://gist.githubusercontent.com';
export const GITHUB_TOKEN_PATTERN =
  /^(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59})$/;
export const GIST_MAX_FILES = 300;
export const GIST_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const GIST_DESCRIPTION_MAX = 256;
export const DEFAULT_GIST_DESCRIPTION = 'Electron Fiddle Gist';
const MAX_REDIRECTS = 5;
const MAX_PAGES = 30;
/** Per request, body included, so a stalled connection ends in an error instead of a spinner. */
const REQUEST_TIMEOUT_MS = 60_000;

export function isValidTokenFormat(token: string): boolean {
  return GITHUB_TOKEN_PATTERN.test(token);
}

function invalid(
  reason: string,
  message: string,
  details: Record<string, unknown> = {},
): FiddleError {
  return new FiddleError(ErrorCode.invalidArgument, message, { reason, ...details });
}

export function assertGistId(id: string): void {
  if (!isGistId(id)) throw invalid('invalid-gist-id', `Invalid gist ID: ${id}`);
}

export function assertGistDescription(description: string): void {
  if (description.length < 1 || description.length > GIST_DESCRIPTION_MAX) {
    throw invalid(
      'invalid-description',
      `Description must be 1–${GIST_DESCRIPTION_MAX} characters`,
    );
  }
}

/** At most 300 files, 10 MB each, plain names. */
export function assertGistFiles(files: FileMap): void {
  const entries = Object.entries(files);
  if (entries.length === 0) throw invalid('no-files', 'A gist needs at least one file');
  if (entries.length > GIST_MAX_FILES)
    throw reasonError(
      ErrorCode.invalidArgument,
      'too-many-files',
      `A gist can have at most ${GIST_MAX_FILES} files`,
      { max: GIST_MAX_FILES },
    );
  for (const [name, content] of entries) {
    if (name === '' || /[/\\]/.test(name))
      throw invalid('invalid-file-name', `Invalid gist file name: ${name}`, { name });
    if (Buffer.byteLength(content, 'utf8') > GIST_MAX_FILE_BYTES) {
      throw reasonError(
        ErrorCode.invalidArgument,
        'file-too-large',
        `${name} is larger than 10 MB`,
        { name, maxMb: GIST_MAX_FILE_BYTES / (1024 * 1024) },
      );
    }
  }
}

/**
 * The files GitHub will accept content for: it rejects blank files with a 422,
 * so they're left out (and deleted on update). Throws `no-files` if none are left.
 */
function nonBlankFiles(files: FileMap): [string, string][] {
  const kept = Object.entries(files).filter(([, content]) => content.trim() !== '');
  if (kept.length === 0)
    throw invalid('no-files', 'A gist needs at least one file that is not empty');
  return kept;
}

const GistFileSchema = z
  .object({
    filename: z.string().optional(),
    content: z.string().optional(),
    truncated: z.boolean().optional(),
    raw_url: z.string().optional(),
  })
  .nullable();

const GistSchema = z.object({
  id: z.string(),
  html_url: z.string().optional(),
  description: z.string().nullable().optional(),
  public: z.boolean().optional(),
  owner: z.object({ login: z.string() }).nullable().optional(),
  history: z.array(z.object({ version: z.string() })).optional(),
  files: z.record(z.string(), GistFileSchema).optional(),
});

const CommitsSchema = z.array(
  z.object({
    version: z.string(),
    committed_at: z.string(),
    change_status: z
      .object({
        total: z.number().optional(),
        additions: z.number().optional(),
        deletions: z.number().optional(),
      })
      .optional(),
  }),
);

const ContentsSchema = z.array(
  z.object({
    name: z.string(),
    path: z.string(),
    type: z.string(),
    download_url: z.string().nullable(),
  }),
);

const UserSchema = z.object({ login: z.string() });

export interface GistLoadResult {
  id: string;
  owner: string | null;
  description: string;
  public: boolean;
  url: string;
  /** The loaded revision's SHA. */
  revision: string;
  /** Every file in the gist; truncated files are fetched in full. Filter with `pickFiddleFiles`. */
  files: FileMap;
  /** Anonymous gists get `ANONYMOUS_GIST_OWNER`. */
  origin: FiddleOrigin;
}

export interface GistWriteResult {
  id: string;
  url: string;
  owner: string | null;
  revision: string | undefined;
  /** The names of the gist's files after the write. */
  files: string[];
}

/** Revision titles are data: render `created` as "Created" and `revision` as "Revision N". */
export type GistRevisionTitle = { key: 'created' } | { key: 'revision'; n: number };

export interface GistRevision {
  sha: string;
  date: string;
  additions: number;
  deletions: number;
  total: number;
  title: GistRevisionTitle;
}

export interface RepoContentEntry {
  name: string;
  path: string;
  type: string;
  downloadUrl: string | null;
}

export interface GitHubClientOptions {
  token?: string;
  /** Default `https://api.github.com`. Injectable for tests and the fixture server. */
  apiBaseUrl?: string;
  /** Other origins allowed to receive the token. Default: the gist raw host. */
  rawOrigins?: readonly string[];
  fetch?: typeof fetch;
  /**
   * Allow plain http to loopback hosts (the e2e fixture server). Off by
   * default; main turns it on only in test mode.
   */
  allowLoopbackHttp?: boolean;
}

function isLoopback(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

async function toResponseError(res: Response): Promise<FiddleError> {
  let detail = '';
  try {
    const body: unknown = await res.json();
    if (
      body &&
      typeof body === 'object' &&
      typeof (body as { message?: unknown }).message === 'string'
    ) {
      detail = (body as { message: string }).message;
    }
  } catch {
    // Not JSON.
  }
  // A rate-limited 403 isn't a bad token, so the startup check must keep it.
  const rateLimited =
    res.status === 429 ||
    (res.status === 403 &&
      (res.headers.get('x-ratelimit-remaining') === '0' ||
        res.headers.has('retry-after')));
  const code =
    res.status === 401
      ? ErrorCode.unauthorized
      : rateLimited
        ? ErrorCode.unavailable
        : res.status === 403
          ? ErrorCode.forbidden
          : res.status === 404
            ? ErrorCode.notFound
            : res.status === 422
              ? ErrorCode.invalidArgument
              : res.status >= 500 || res.status === 429
                ? ErrorCode.unavailable
                : ErrorCode.internal;
  const message = `GitHub responded ${res.status}${detail ? `: ${detail}` : ''}`;
  const reason = rateLimited
    ? 'rate-limited'
    : detail
      ? 'github-response-detail'
      : 'github-response';
  return reasonError(code, reason, message, { status: res.status, detail });
}

const isAbortError = (error: unknown) =>
  error instanceof Error && error.name === 'AbortError';

function toFetchError(
  error: unknown,
  signal: AbortSignal | undefined,
  timeout: AbortSignal,
): FiddleError {
  if (error instanceof FiddleError) return error;
  if (signal?.aborted || (!timeout.aborted && isAbortError(error))) {
    return new FiddleError(ErrorCode.cancelled, 'The request was cancelled');
  }
  if (timeout.aborted) {
    return reasonError(ErrorCode.network, 'timeout', 'GitHub did not respond in time.');
  }
  return reasonError(ErrorCode.network, 'unreachable', 'Could not reach GitHub.', {
    cause: error instanceof Error ? error.message : String(error),
  });
}

/**
 * A small GitHub REST client on `fetch`. The token is sent only over https
 * (or to a loopback fixture server) to the API origin and the gist raw origin,
 * and is dropped on any cross-origin redirect.
 */
export class GitHubClient {
  private readonly token: string | undefined;
  private readonly apiBase: URL;
  private readonly trustedOrigins: Set<string>;
  private readonly fetchFn: typeof fetch;
  private readonly allowLoopbackHttp: boolean;

  constructor(options: GitHubClientOptions = {}) {
    this.token = options.token;
    this.apiBase = new URL(options.apiBaseUrl ?? GITHUB_API_URL);
    this.trustedOrigins = new Set([
      this.apiBase.origin,
      ...(options.rawOrigins ?? [GIST_RAW_ORIGIN]),
    ]);
    this.fetchFn = options.fetch ?? fetch;
    this.allowLoopbackHttp = options.allowLoopbackHttp ?? false;
  }

  private isSecure(url: URL): boolean {
    return (
      url.protocol === 'https:' || (this.allowLoopbackHttp && isLoopback(url.hostname))
    );
  }

  private mayReceiveToken(url: URL): boolean {
    return this.trustedOrigins.has(url.origin) && this.isSecure(url);
  }

  private apiUrl(path: string): URL {
    const base = this.apiBase.href.endsWith('/')
      ? this.apiBase.href
      : `${this.apiBase.href}/`;
    return new URL(path.replace(/^\//, ''), base);
  }

  /** Sends a request, following up to 5 redirects by hand. */
  private async send(
    url: URL,
    init: { method?: string; body?: unknown; accept?: string; signal?: AbortSignal } = {},
  ): Promise<Response> {
    let current = url;
    let method = init.method ?? 'GET';
    let body = init.body === undefined ? undefined : JSON.stringify(init.body);
    let withToken = this.token !== undefined && this.mayReceiveToken(current);

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const headers: Record<string, string> = {
        Accept: init.accept ?? 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      };
      if (withToken) headers.Authorization = `Bearer ${this.token}`;
      if (body !== undefined) headers['Content-Type'] = 'application/json';

      const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
      let res: Response;
      try {
        res = await this.fetchFn(current, {
          method,
          body,
          headers,
          redirect: 'manual',
          signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
        });
      } catch (error) {
        throw toFetchError(error, init.signal, timeout);
      }

      const location = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && location) {
        const next = new URL(location, current);
        if (next.origin !== current.origin) withToken = false;
        if (
          res.status === 303 ||
          ((res.status === 301 || res.status === 302) && method === 'POST')
        ) {
          method = 'GET';
          body = undefined;
        }
        current = next;
        continue;
      }
      return res;
    }
    throw reasonError(
      ErrorCode.network,
      'too-many-redirects',
      'Too many redirects from GitHub',
    );
  }

  private async json<T>(res: Response, schema: z.ZodType<T>): Promise<T> {
    if (!res.ok) throw await toResponseError(res);
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      data = undefined;
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success)
      throw reasonError(
        ErrorCode.internal,
        'unexpected-response',
        'Unexpected response from GitHub',
      );
    return parsed.data;
  }

  private requireToken(): void {
    if (!this.token) {
      throw new FiddleError(ErrorCode.unauthorized, 'Sign in to GitHub first', {
        reason: 'signed-out',
      });
    }
  }

  /**
   * The signed-in user's login and the token's scopes, which GitHub reports
   * for classic tokens only. 401 → `unauthorized`, 403 → `forbidden`, offline → `network`.
   */
  async getAuthenticatedUser(
    signal?: AbortSignal,
  ): Promise<{ login: string; scopes: string[] | undefined }> {
    this.requireToken();
    const res = await this.send(this.apiUrl('/user'), { signal });
    const user = await this.json(res, UserSchema);
    const header = res.headers.get('x-oauth-scopes');
    const scopes = header
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return { login: user.login, scopes };
  }

  /**
   * Sign-in check: the token must look right, be accepted, and, if it is a
   * classic token, have the `gist` scope (a fine-grained token's permissions
   * are only known when it is used). Failures carry `details.reason`:
   * `bad-format`, `invalid-token` or `missing-scope`.
   */
  async verifyToken(signal?: AbortSignal): Promise<string> {
    if (!this.token || !isValidTokenFormat(this.token)) {
      throw new FiddleError(ErrorCode.invalidArgument, 'Invalid token format', {
        reason: 'bad-format',
      });
    }
    let user: { login: string; scopes: string[] | undefined };
    try {
      user = await this.getAuthenticatedUser(signal);
    } catch (error) {
      const e = FiddleError.from(error);
      if (e.code === ErrorCode.unauthorized || e.code === ErrorCode.forbidden) {
        throw new FiddleError(ErrorCode.unauthorized, 'Invalid GitHub token', {
          reason: 'invalid-token',
        });
      }
      throw e;
    }
    if (user.scopes && !user.scopes.includes('gist')) {
      throw new FiddleError(
        ErrorCode.forbidden,
        'The token is missing the "gist" scope',
        { reason: 'missing-scope' },
      );
    }
    return user.login;
  }

  /** Fetches text from an https URL (loopback too, if allowed), with the token only for trusted origins. */
  async fetchText(url: string, signal?: AbortSignal): Promise<string> {
    const target = new URL(url);
    if (!this.isSecure(target)) {
      throw invalid('insecure-url', `Refusing to fetch ${target.origin}`);
    }
    const res = await this.send(target, { signal, accept: '*/*' });
    if (!res.ok) throw await toResponseError(res);
    return res.text();
  }

  /** Loads a gist, optionally at a revision. Works signed out for public gists. */
  async loadGist(
    id: string,
    revision?: string,
    signal?: AbortSignal,
  ): Promise<GistLoadResult> {
    assertGistId(id);
    if (revision !== undefined && !isRevisionSha(revision)) {
      throw invalid('invalid-revision', `Invalid revision: ${revision}`);
    }
    const path = revision ? `/gists/${id}/${revision.toLowerCase()}` : `/gists/${id}`;
    const gist = await this.json(
      await this.send(this.apiUrl(path), { signal }),
      GistSchema,
    );
    const sha = revision?.toLowerCase() ?? gist.history?.[0]?.version;
    if (!sha)
      throw new FiddleError(
        ErrorCode.internal,
        'GitHub returned a gist without history',
        { reason: 'no-history' },
      );

    const files = await Promise.all(
      Object.entries(gist.files ?? {}).flatMap(([key, file]) =>
        file
          ? [
              (async (): Promise<[string, string]> => [
                file.filename ?? key,
                file.truncated && file.raw_url
                  ? await this.fetchText(file.raw_url, signal)
                  : (file.content ?? ''),
              ])(),
            ]
          : [],
      ),
    );

    return {
      id: gist.id,
      owner: gist.owner?.login ?? null,
      description: gist.description ?? '',
      public: gist.public ?? false,
      url: gist.html_url ?? gistUrl(id),
      revision: sha,
      files: Object.fromEntries(files),
      origin: gistOrigin(id, sha, gist.owner?.login ?? null),
    };
  }

  async createGist(
    input: { description: string; files: FileMap; isPublic: boolean },
    signal?: AbortSignal,
  ): Promise<GistWriteResult> {
    this.requireToken();
    assertGistDescription(input.description);
    assertGistFiles(input.files);
    const body = {
      description: input.description,
      public: input.isPublic,
      files: Object.fromEntries(
        nonBlankFiles(input.files).map(([name, content]) => [name, { content }]),
      ),
    };
    const res = await this.send(this.apiUrl('/gists'), { method: 'POST', body, signal });
    return this.writeResult(await this.json(res, GistSchema));
  }

  /**
   * Writes `files` to the gist. A remote file that is missing from `files`, or
   * empty in it, is deleted only if `canDelete` accepts its name; the gist's
   * other files (a README, images, files the fiddle never loaded) stay.
   * `remote` is the gist's file names, when the caller just wrote them.
   */
  async updateGist(
    id: string,
    input: {
      files: FileMap;
      canDelete: (name: string) => boolean;
      remote?: readonly string[];
      description?: string;
    },
    signal?: AbortSignal,
  ): Promise<GistWriteResult> {
    this.requireToken();
    assertGistId(id);
    assertGistFiles(input.files);
    const kept = nonBlankFiles(input.files);
    if (input.description !== undefined) assertGistDescription(input.description);

    const remote =
      input.remote ??
      Object.keys(
        (
          await this.json(
            await this.send(this.apiUrl(`/gists/${id}`), { signal }),
            GistSchema,
          )
        ).files ?? {},
      );
    const keptNames = new Set(kept.map(([name]) => name));
    const removed = remote.filter(
      (name) => !keptNames.has(name) && input.canDelete(name),
    );
    const files = Object.fromEntries([
      ...kept.map(([name, content]) => [name, { content }] as const),
      ...removed.map((name) => [name, null] as const),
    ]);
    const body =
      input.description === undefined
        ? { files }
        : { files, description: input.description };
    const res = await this.send(this.apiUrl(`/gists/${id}`), {
      method: 'PATCH',
      body,
      signal,
    });
    return this.writeResult(await this.json(res, GistSchema));
  }

  async deleteGist(id: string, signal?: AbortSignal): Promise<void> {
    this.requireToken();
    assertGistId(id);
    const res = await this.send(this.apiUrl(`/gists/${id}`), {
      method: 'DELETE',
      signal,
    });
    if (!res.ok) throw await toResponseError(res);
  }

  /** Revisions oldest first. Revisions with no changes are dropped, except the first. */
  async listGistRevisions(id: string, signal?: AbortSignal): Promise<GistRevision[]> {
    assertGistId(id);
    const commits: z.infer<typeof CommitsSchema> = [];
    let url: URL | undefined = this.apiUrl(`/gists/${id}/commits?per_page=100`);
    for (let page = 0; url && page < MAX_PAGES; page++) {
      const res = await this.send(url, { signal });
      commits.push(...(await this.json(res, CommitsSchema)));
      const next = /<([^>]+)>;\s*rel="next"/.exec(res.headers.get('link') ?? '')?.[1];
      url = next ? new URL(next, url) : undefined;
    }

    const oldest = commits.at(-1);
    return commits
      .filter(
        (c) =>
          c === oldest ||
          (c.change_status?.additions ?? 0) > 0 ||
          (c.change_status?.deletions ?? 0) > 0,
      )
      .reverse()
      .map((c, i) => ({
        sha: c.version,
        date: c.committed_at,
        additions: c.change_status?.additions ?? 0,
        deletions: c.change_status?.deletions ?? 0,
        total: c.change_status?.total ?? 0,
        title: i === 0 ? { key: 'created' } : { key: 'revision', n: i },
      }));
  }

  /** Lists a repository directory at `ref` through the contents API. */
  async listRepoDirectory(
    owner: string,
    repo: string,
    path: string,
    ref: string,
    signal?: AbortSignal,
  ): Promise<RepoContentEntry[]> {
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const url = this.apiUrl(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`,
    );
    const res = await this.send(url, { signal });
    if (!res.ok) throw await toResponseError(res);
    const parsed = ContentsSchema.safeParse(await res.json().catch(() => undefined));
    if (!parsed.success)
      throw invalid('not-a-directory', `${owner}/${repo}/${path}@${ref} is not a folder`);
    return parsed.data.map((e) => ({
      name: e.name,
      path: e.path,
      type: e.type,
      downloadUrl: e.download_url,
    }));
  }

  private writeResult(gist: z.infer<typeof GistSchema>): GistWriteResult {
    return {
      id: gist.id,
      url: gist.html_url ?? gistUrl(gist.id),
      owner: gist.owner?.login ?? null,
      revision: gist.history?.[0]?.version,
      files: Object.keys(gist.files ?? {}),
    };
  }
}
