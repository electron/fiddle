import { lstat, mkdir, readdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

import { ErrorCode, FiddleError } from '../shared/errors';
import {
  type FileMap,
  fileRuleError,
  hasInvalidCharacter,
  hasName,
  hasPathSeparator,
  isSupportedFileName,
  PACKAGE_JSON,
} from './files';
import { type PickedFiles, pickFiddleFiles, type PickOptions } from './pick';

export const GITIGNORE_CONTENT = 'node_modules\nout';

export type FolderReadResult = PickedFiles;

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

/**
 * Reads a fiddle folder's top-level regular files (never symlinks or
 * folders) through `pickFiddleFiles`. Unsupported files aren't read.
 */
export async function readFiddleFolder(dir: string, options: PickOptions = {}): Promise<FolderReadResult> {
  const names: string[] = [];
  const skipped: string[] = [];
  for (const entry of await listDir(dir)) {
    if (!entry.isFile()) continue;
    if (isSupportedFileName(entry.name) || entry.name === PACKAGE_JSON) names.push(entry.name);
    else skipped.push(entry.name);
  }
  const contents = await Promise.all(names.map((name) => readFile(path.join(dir, name), 'utf8')));
  const picked = pickFiddleFiles(Object.fromEntries(names.map((name, i) => [name, contents[i]!])), options);
  return { ...picked, skipped: [...skipped, ...picked.skipped] };
}

/** The same name rules as `files.ts`, plus `package.json`. Names that differ only in case are refused. */
function assertWritableNames(names: readonly string[]): void {
  const seen: string[] = [];
  for (const name of names) {
    if (name !== PACKAGE_JSON) {
      if (name === '') throw fileRuleError('empty-name', name);
      if (hasPathSeparator(name)) throw fileRuleError('path-separator', name);
      if (hasInvalidCharacter(name)) throw fileRuleError('invalid-character', name);
      if (!isSupportedFileName(name)) throw fileRuleError('unsupported-extension', name);
    }
    if (hasName(seen, name)) throw fileRuleError('duplicate-name', name);
    seen.push(name);
  }
}

/** Writes `target` as a regular file. A symlink there is replaced, never followed. */
async function writeRegularFile(target: string, content: string): Promise<void> {
  try {
    if ((await lstat(target)).isSymbolicLink()) await unlink(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await writeFile(target, content, 'utf8');
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
  assertWritableNames(entries.map(([name]) => name));
  await mkdir(dir, { recursive: true });
  for (const [name, content] of entries) {
    const target = path.join(dir, name);
    // rm removes a symlink itself, not what it points to.
    if (content === '') await rm(target, { force: true });
    else await writeRegularFile(target, content);
  }
  await writeRegularFile(path.join(dir, '.gitignore'), GITIGNORE_CONTENT);
}
