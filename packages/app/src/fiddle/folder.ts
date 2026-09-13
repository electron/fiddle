import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

import { ErrorCode, FiddleError } from '../shared/errors';
import { ensureMainEntry, type FileMap, isReservedFileName, isSupportedFileName, PACKAGE_JSON } from './files';
import { type ParsedPackageJson, parsePackageJson } from './package-json';

export const GITIGNORE_CONTENT = 'node_modules\nout';

export interface FolderReadResult {
  /** Supported top-level files, with a main entry added if missing. */
  files: FileMap;
  packageJson?: ParsedPackageJson;
  /** Set when `package.json` is invalid. The rest of the folder still loads. */
  packageJsonError?: FiddleError;
}

async function listDir(dir: string) {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      throw new FiddleError(ErrorCode.notFound, `Folder not found: ${dir}`, { path: dir });
    }
    throw error;
  }
}

/** Reads a fiddle folder: supported top-level files (not symlinks), plus `package.json`. */
export async function readFiddleFolder(dir: string): Promise<FolderReadResult> {
  const entries = await listDir(dir);
  const names = entries
    .filter((e) => e.isFile() && isSupportedFileName(e.name) && !isReservedFileName(e.name))
    .map((e) => e.name);
  const contents = await Promise.all(names.map((name) => readFile(path.join(dir, name), 'utf8')));
  const result: FolderReadResult = {
    files: ensureMainEntry(Object.fromEntries(names.map((name, i) => [name, contents[i]!]))),
  };

  if (entries.some((e) => e.isFile() && e.name === PACKAGE_JSON)) {
    try {
      result.packageJson = parsePackageJson(await readFile(path.join(dir, PACKAGE_JSON), 'utf8'));
    } catch (error) {
      result.packageJsonError = FiddleError.from(error);
    }
  }
  return result;
}

/** Throws unless `name` is a plain file name that can't escape its folder. */
export function assertSafeFileName(name: string): void {
  if (
    name === '' ||
    name === '.' ||
    name === '..' ||
    /[/\\\0]/.test(name) ||
    /^[a-z]:/i.test(name) ||
    path.basename(name) !== name
  ) {
    throw new FiddleError(ErrorCode.invalidArgument, `Unsafe file name: ${name}`, { reason: 'unsafe-path', name });
  }
}

/** Supported files already in `dir`, for the overwrite warning. Empty if `dir` doesn't exist. */
export async function findExistingSupportedFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile() && isSupportedFileName(e.name)).map((e) => e.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

/**
 * Writes a fiddle to `dir`: files with empty content are deleted from disk,
 * and `.gitignore` is written on every save. All names are checked first.
 */
export async function writeFiddleFolder(dir: string, files: FileMap): Promise<void> {
  const entries = Object.entries(files);
  for (const [name] of entries) assertSafeFileName(name);
  await mkdir(dir, { recursive: true });
  for (const [name, content] of entries) {
    const target = path.join(dir, name);
    if (content === '') await rm(target, { force: true });
    else await writeFile(target, content, 'utf8');
  }
  await writeFile(path.join(dir, '.gitignore'), GITIGNORE_CONTENT, 'utf8');
}
