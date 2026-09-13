import { access, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

import * as semver from 'semver';

import { ErrorCode, FiddleError } from '../shared/errors';
import { type FileMap, isReservedFileName, isSupportedFileName } from './files';
import { readFiddleFolder } from './folder';
import { readZip } from './zip';

export const MINIMAL_REPRO_ARCHIVE_URL = 'https://github.com/electron/minimal-repro/archive';
export const TEST_TEMPLATE_BRANCH = 'test-template';
export const QUICK_START_DIR = 'electron-quick-start';

export interface TemplateLoaderOptions {
  /** The app's static dir, holding `electron-quick-start/`. */
  staticDir: string;
  /** Where downloaded templates are cached, e.g. `<cache>/templates`. */
  cacheDir: string;
  isReleasedMajor: (major: number) => boolean;
  fetch?: typeof fetch;
  archiveBaseUrl?: string;
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

/** Downloads `<branch>.zip` and extracts its top-level supported files into `<cacheDir>/minimal-repro-<branch>/`. */
async function downloadTemplate(options: TemplateLoaderOptions, branch: string): Promise<string> {
  const target = path.join(options.cacheDir, `minimal-repro-${branch}`);
  if (await exists(target)) return target;

  const url = `${options.archiveBaseUrl ?? MINIMAL_REPRO_ARCHIVE_URL}/${branch}.zip`;
  const res = await (options.fetch ?? fetch)(url);
  if (!res.ok) throw new FiddleError(ErrorCode.network, `${url} responded ${res.status}`, { status: res.status });
  const entries = readZip(Buffer.from(await res.arrayBuffer()));

  await mkdir(options.cacheDir, { recursive: true });
  const tmp = await mkdtemp(path.join(options.cacheDir, `.tmp-${branch}-`));
  try {
    let written = 0;
    for (const entry of entries) {
      // Only files directly inside the archive's single root folder.
      const parts = entry.name.split('/');
      const name = parts[1];
      if (parts.length !== 2 || !name || !isSupportedFileName(name) || isReservedFileName(name)) continue;
      await writeFile(path.join(tmp, name), entry.data);
      written++;
    }
    if (written === 0) throw new FiddleError(ErrorCode.invalidArgument, `${url} has no supported files`);
    await rename(tmp, target);
  } catch (error) {
    await rm(tmp, { recursive: true, force: true });
    // Another download may have finished first.
    if (!(await exists(target))) throw error;
  }
  return target;
}

export function createTemplateLoader(options: TemplateLoaderOptions): TemplateLoader {
  const pending = new Map<string, Promise<FileMap>>();
  const getQuickStart = () => readQuickStart(options.staticDir);

  const load = async (branch: string): Promise<FileMap> => {
    let promise = pending.get(branch);
    if (!promise) {
      promise = downloadTemplate(options, branch).then(async (dir) => (await readFiddleFolder(dir)).files);
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
