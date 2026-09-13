import { access, mkdir, mkdtemp, readdir, rename, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

import * as semver from 'semver';

import { ErrorCode, FiddleError } from '../shared/errors';
import type { FileMap } from './files';
import { readFiddleFolder } from './folder';

export const MINIMAL_REPRO_ARCHIVE_URL = 'https://github.com/electron/minimal-repro/archive';
export const TEST_TEMPLATE_BRANCH = 'test-template';
export const QUICK_START_DIR = 'electron-quick-start';
export const TEMPLATE_TIMEOUT_MS = 60_000;

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
  /** Aborts downloads in flight, e.g. on quit. */
  signal?: AbortSignal;
  /** Called when a download fails and the bundled template is used instead. */
  onFallback?: (branch: string, error: unknown) => void;
}

export interface TemplateLoader {
  /** The template for a version. Local builds pass no version and get the bundled quick-start. */
  getTemplate(version?: string): Promise<FileMap>;
  getTestTemplate(): Promise<FileMap>;
  getQuickStart(): Promise<FileMap>;
}

/** The minimal-repro branch for a version (`30-x-y`), or null for unreleased majors and non-releases. */
export function templateBranch(version: string, isReleasedMajor: (major: number) => boolean): string | null {
  const parsed = semver.parse(version);
  if (!parsed || parsed.major === 0 || !isReleasedMajor(parsed.major)) return null;
  return `${parsed.major}-x-y`;
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

async function fetchArchive(options: TemplateLoaderOptions, url: string): Promise<Uint8Array> {
  const timeout = AbortSignal.timeout(options.timeoutMs ?? TEMPLATE_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  try {
    const res = await (options.fetch ?? fetch)(url, { signal });
    if (!res.ok) throw new FiddleError(ErrorCode.network, `${url} responded ${res.status}`, { status: res.status });
    return new Uint8Array(await res.arrayBuffer());
  } catch (error) {
    if (error instanceof FiddleError) throw error;
    if (options.signal?.aborted) throw new FiddleError(ErrorCode.cancelled, 'The template download was cancelled');
    throw new FiddleError(ErrorCode.network, `Could not download ${url}`, {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

/** The archive's single top-level folder, or `dir` itself if there isn't exactly one. */
async function archiveRoot(dir: string): Promise<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.length === 1 && entries[0]!.isDirectory() ? path.join(dir, entries[0]!.name) : dir;
}

/**
 * The template's files, from `<cacheDir>/minimal-repro-<branch>/`. On a miss,
 * `<branch>.zip` is downloaded to a temp file and extracted into a temp dir,
 * whose root folder is read and then renamed into place.
 */
async function downloadTemplate(options: TemplateLoaderOptions, branch: string): Promise<FileMap> {
  const target = path.join(options.cacheDir, `minimal-repro-${branch}`);
  if (await exists(target)) return (await readFiddleFolder(target)).files;

  const url = `${options.archiveBaseUrl ?? MINIMAL_REPRO_ARCHIVE_URL}/${branch}.zip`;
  const archive = await fetchArchive(options, url);
  await mkdir(options.cacheDir, { recursive: true });
  const work = await mkdtemp(path.join(options.cacheDir, `.tmp-${branch}-`));
  try {
    const zipPath = path.join(work, 'archive.zip');
    const out = path.join(work, 'out');
    await writeFile(zipPath, archive);
    await mkdir(out);
    // Native addon: loaded on first use, never at import time.
    const { default: extract } = await import('@electron-internal/extract-zip');
    await extract(zipPath, { dir: out });
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

export function createTemplateLoader(options: TemplateLoaderOptions): TemplateLoader {
  const pending = new Map<string, Promise<FileMap>>();
  const getQuickStart = () => readQuickStart(options.staticDir);

  const load = async (branch: string): Promise<FileMap> => {
    let promise = pending.get(branch);
    if (!promise) {
      promise = downloadTemplate(options, branch);
      pending.set(branch, promise);
    }
    try {
      return { ...(await promise) };
    } catch (error) {
      pending.delete(branch);
      options.onFallback?.(branch, error);
      return getQuickStart();
    }
  };

  return {
    getTemplate(version) {
      const branch = version === undefined ? null : templateBranch(version, options.isReleasedMajor);
      return branch ? load(branch) : getQuickStart();
    },
    getTestTemplate: () => load(TEST_TEMPLATE_BRANCH),
    getQuickStart,
  };
}
