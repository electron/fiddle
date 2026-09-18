import { randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { ErrorCode, FiddleError } from '../shared/errors';
import {
  type FileMap,
  fileRuleError,
  hasInvalidCharacter,
  hasName,
  hasPathSeparator,
  isSupportedFileName,
  isWindowsReservedName,
  PACKAGE_JSON,
} from './files';
import { type PickedFiles, pickFiddleFiles, type PickOptions } from './pick';

export const GITIGNORE_CONTENT = 'node_modules\nout';
const GITIGNORE = '.gitignore';

export type FolderReadResult = PickedFiles;

async function listDir(dir: string) {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      throw new FiddleError(ErrorCode.notFound, `Folder not found: ${dir}`, {
        path: dir,
      });
    }
    throw error;
  }
}

/**
 * Reads a fiddle folder's top-level regular files (never symlinks or
 * folders) through `pickFiddleFiles`. Unsupported files aren't read.
 */
export async function readFiddleFolder(
  dir: string,
  options: PickOptions = {},
): Promise<FolderReadResult> {
  const names: string[] = [];
  const skipped: string[] = [];
  for (const entry of await listDir(dir)) {
    if (!entry.isFile()) continue;
    if (isSupportedFileName(entry.name) || entry.name === PACKAGE_JSON)
      names.push(entry.name);
    else skipped.push(entry.name);
  }
  const contents = await Promise.all(
    names.map((name) => readFile(path.join(dir, name), 'utf8')),
  );
  const picked = pickFiddleFiles(
    Object.fromEntries(names.map((name, i) => [name, contents[i]!])),
    options,
  );
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
      if (isWindowsReservedName(name)) throw fileRuleError('reserved-name', name);
    }
    if (hasName(seen, name)) throw fileRuleError('duplicate-name', name);
    seen.push(name);
  }
}

const RENAME_RETRIES = 5;
const RENAME_RETRY_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);

/** On Windows, a file another process has open (an editor, an indexer, a virus scanner) refuses to be replaced for a moment. */
async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? '';
      if (
        process.platform !== 'win32' ||
        !RENAME_RETRY_CODES.has(code) ||
        attempt >= RENAME_RETRIES
      )
        throw error;
      await sleep(25 * 2 ** attempt);
    }
  }
}

/**
 * Writes `target` as a regular file: the content goes to a new temp file in
 * the same folder, created exclusively (`wx` never opens through an existing
 * link), which is then renamed over `target`. A rename replaces a symlink at
 * `target` instead of following it, so a link created after any check is
 * never written through.
 */
async function writeRegularFile(target: string, content: string): Promise<void> {
  const temp = path.join(
    path.dirname(target),
    `.${path.basename(target)}.${randomBytes(6).toString('hex')}.tmp`,
  );
  await writeFile(temp, content, { encoding: 'utf8', flag: 'wx' });
  try {
    await renameWithRetry(temp, target);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}

/**
 * Everything in `dir` that `writeFiddleFolder(dir, files)` would replace or
 * delete, for the overwrite warning: each name in `files` (empty ones are
 * deleted) and `.gitignore`, matched ignoring case as on macOS and Windows.
 * Empty if `dir` doesn't exist.
 */
export async function findFilesToReplace(dir: string, files: FileMap): Promise<string[]> {
  const targets = [...Object.keys(files), GITIGNORE];
  try {
    return (await readdir(dir)).filter((name) => hasName(targets, name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

/**
 * Writes a fiddle to `dir`: files with empty content are deleted from disk,
 * and `.gitignore` is written on every save. `remove` names files the fiddle
 * no longer has (removed or renamed), which are deleted before anything is
 * written, so a rename that only changes case ends with the new name. All
 * names are checked first.
 */
export async function writeFiddleFolder(
  dir: string,
  files: FileMap,
  remove: readonly string[] = [],
): Promise<void> {
  const entries = Object.entries(files);
  assertWritableNames(entries.map(([name]) => name));
  assertWritableNames(remove);
  await mkdir(dir, { recursive: true });
  for (const name of remove) await rm(path.join(dir, name), { force: true });
  for (const [name, content] of entries) {
    const target = path.join(dir, name);
    // rm removes a symlink itself, not what it points to.
    if (content === '') await rm(target, { force: true });
    else await writeRegularFile(target, content);
  }
  await writeRegularFile(path.join(dir, GITIGNORE), GITIGNORE_CONTENT);
}

/**
 * The local path of a dropped `file:` URL, or undefined if it could reach
 * another machine: a host other than none or `localhost` (the URL parser
 * turns `localhost` into none), or a UNC path such as `\\server\share` or
 * `//server/share`.
 */
export function localPathFromFileUrl(
  url: string,
  platform: NodeJS.Platform = process.platform,
): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== 'file:' || parsed.hostname !== '') return undefined;
  let target: string;
  try {
    target = fileURLToPath(parsed, { windows: platform === 'win32' });
  } catch {
    return undefined;
  }
  return /^[\\/]{2}/.test(target) ? undefined : target;
}
