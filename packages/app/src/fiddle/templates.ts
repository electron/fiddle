import {
  access,
  mkdir,
  mkdtemp,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import * as path from 'node:path';

import { extractZip } from '@electron/fiddle-core';
import * as semver from 'semver';

import { ErrorCode, FiddleError } from '../shared/errors';
import type { FileMap } from './files';
import { readFiddleFolder } from './folder';

export const MINIMAL_REPRO_ARCHIVE_URL =
  'https://github.com/electron/minimal-repro/archive';
export const TEST_TEMPLATE_BRANCH = 'test-template';
export const QUICK_START_DIR = 'electron-quick-start';
export const TEMPLATE_TIMEOUT_MS = 60_000;
/** How long a branch minimal-repro doesn't have (a 404) goes without being requested again. */
export const MISSING_TEMPLATE_TTL_MS = 24 * 60 * 60 * 1000;

export interface TemplateLoaderOptions {
  /** The app's static dir, holding `electron-quick-start/`. */
  staticDir: string;
  /** Where downloaded templates are cached, e.g. `<cache>/templates`. */
  cacheDir: string;
  isReleasedMajor: (major: number) => boolean;
  fetch?: typeof fetch;
  archiveBaseUrl?: string;
  /** Per-download timeout. Default {@link TEMPLATE_TIMEOUT_MS}. */
  timeoutMs?: number;
  /**
   * How long a call waits for a download before it returns the bundled
   * template. The download goes on, so a later call finds it. Default: wait
   * for the download.
   */
  waitMs?: number;
  /** Aborts downloads in flight, e.g. on quit. */
  signal?: AbortSignal;
  /**
   * Called when the bundled template is used instead of a download: with a
   * `not-found` FiddleError when minimal-repro has no branch for the major
   * yet ({@link isMissingTemplate}), once per branch, or with the error of a
   * failed download, which the next call retries.
   */
  onFallback?: (branch: string, error: unknown) => void;
}

export interface TemplateLoader {
  /** The template for a version. Local builds pass no version and get the bundled quick-start. */
  getTemplate(version?: string): Promise<FileMap>;
  getTestTemplate(): Promise<FileMap>;
  getQuickStart(): Promise<FileMap>;
}

/** The minimal-repro branch for a version (`30-x-y`), or null for unreleased majors and non-releases. */
export function templateBranch(
  version: string,
  isReleasedMajor: (major: number) => boolean,
): string | null {
  const parsed = semver.parse(version);
  if (!parsed || parsed.major === 0 || !isReleasedMajor(parsed.major)) return null;
  return `${parsed.major}-x-y`;
}

/** Whether an `onFallback` error says minimal-repro has no branch for the major (yet), rather than a failed download. */
export function isMissingTemplate(error: unknown): boolean {
  return error instanceof FiddleError && error.code === ErrorCode.notFound;
}

export async function readQuickStart(staticDir: string): Promise<FileMap> {
  return (await readFiddleFolder(path.join(staticDir, QUICK_START_DIR))).files;
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** Whether `file` exists and was written less than `ttlMs` ago. */
async function writtenWithin(file: string, ttlMs: number): Promise<boolean> {
  try {
    return Date.now() - (await stat(file)).mtimeMs < ttlMs;
  } catch {
    return false;
  }
}

async function fetchArchive(
  options: TemplateLoaderOptions,
  url: string,
): Promise<Uint8Array> {
  const timeout = AbortSignal.timeout(options.timeoutMs ?? TEMPLATE_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  try {
    const res = await (options.fetch ?? fetch)(url, { signal });
    if (!res.ok) {
      // A 404 is a branch minimal-repro doesn't have (yet), not a failed download.
      const code = res.status === 404 ? ErrorCode.notFound : ErrorCode.network;
      throw new FiddleError(code, `${url} responded ${res.status}`, {
        status: res.status,
      });
    }
    return new Uint8Array(await res.arrayBuffer());
  } catch (error) {
    if (error instanceof FiddleError) throw error;
    if (options.signal?.aborted)
      throw new FiddleError(ErrorCode.cancelled, 'The template download was cancelled');
    throw new FiddleError(ErrorCode.network, `Could not download ${url}`, {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

/** The archive's single top-level folder, or `dir` itself if there isn't exactly one. */
async function archiveRoot(dir: string): Promise<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.length === 1 && entries[0]!.isDirectory()
    ? path.join(dir, entries[0]!.name)
    : dir;
}

/**
 * The template's files, from `<cacheDir>/minimal-repro-<branch>/`, downloaded
 * on a miss. A 404 leaves a `.missing` marker that fails as `not-found`
 * without a request for {@link MISSING_TEMPLATE_TTL_MS}, so launches don't
 * keep asking for a branch minimal-repro doesn't have.
 */
async function downloadTemplate(
  options: TemplateLoaderOptions,
  branch: string,
): Promise<FileMap> {
  const target = path.join(options.cacheDir, `minimal-repro-${branch}`);
  if (await exists(target)) return (await readFiddleFolder(target)).files;
  const marker = `${target}.missing`;
  if (await writtenWithin(marker, MISSING_TEMPLATE_TTL_MS)) {
    throw new FiddleError(
      ErrorCode.notFound,
      `minimal-repro had no ${branch} branch within the last day`,
    );
  }

  const url = `${options.archiveBaseUrl ?? MINIMAL_REPRO_ARCHIVE_URL}/${branch}.zip`;
  let archive: Uint8Array;
  try {
    archive = await fetchArchive(options, url);
  } catch (error) {
    // Only a missing branch is remembered. Offline, 5xx and timeouts are retried on the next call.
    if (isMissingTemplate(error)) {
      try {
        await mkdir(options.cacheDir, { recursive: true });
        await writeFile(marker, `${new Date().toISOString()}\n`);
      } catch {
        // Falling back matters more than remembering the miss.
      }
    }
    throw error;
  }
  await mkdir(options.cacheDir, { recursive: true });
  const work = await mkdtemp(path.join(options.cacheDir, `.tmp-${branch}-`));
  try {
    const zipPath = path.join(work, 'archive.zip');
    const out = path.join(work, 'out');
    await writeFile(zipPath, archive);
    await mkdir(out);
    await extractZip(zipPath, out);
    const root = await archiveRoot(out);
    const { files } = await readFiddleFolder(root);
    try {
      await rename(root, target);
    } catch (error) {
      // Another download may have finished first.
      if (!(await exists(target))) throw error;
    }
    return files;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

/** `promise`'s value, or undefined if it takes longer than `ms`. Never rejects on its own. */
function withinWait<T>(
  promise: Promise<T>,
  ms: number | undefined,
): Promise<T | undefined> {
  if (ms === undefined) return promise;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms, undefined);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function createTemplateLoader(options: TemplateLoaderOptions): TemplateLoader {
  const pending = new Map<string, Promise<FileMap>>();
  const getQuickStart = () => readQuickStart(options.staticDir);

  const load = async (branch: string): Promise<FileMap> => {
    let promise = pending.get(branch);
    if (!promise) {
      promise = downloadTemplate(options, branch).catch((error: unknown) => {
        // A missing branch stays missing for this process. Any other failure is retried on the next call.
        if (!isMissingTemplate(error)) pending.delete(branch);
        options.onFallback?.(branch, error);
        return getQuickStart();
      });
      pending.set(branch, promise);
    }
    return {
      ...((await withinWait(promise, options.waitMs)) ?? (await getQuickStart())),
    };
  };

  return {
    getTemplate(version) {
      const branch =
        version === undefined ? null : templateBranch(version, options.isReleasedMajor);
      return branch ? load(branch) : getQuickStart();
    },
    getTestTemplate: () => load(TEST_TEMPLATE_BRANCH),
    getQuickStart,
  };
}
