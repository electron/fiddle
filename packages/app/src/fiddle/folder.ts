import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeAtomic } from '@electron/fiddle-core';

import { ErrorCode } from '../shared/errors';
import { reasonError } from './error-reasons';
import {
  assertValidFileName,
  type FileMap,
  fileRuleError,
  hasName,
  isSupportedFileName,
  PACKAGE_JSON,
} from './files';
import { type PickedFiles, pickFiddleFiles } from './pick';

/** Windows refuses to delete a file another process has open, for a moment. */
const RM_OPTIONS = { force: true, maxRetries: 5 };

export const GITIGNORE_CONTENT = 'node_modules\nout';
const GITIGNORE = '.gitignore';

export type FolderReadResult = PickedFiles;

async function listDir(dir: string) {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      throw reasonError(
        ErrorCode.notFound,
        'folder-not-found',
        `Folder not found: ${dir}`,
        {
          path: dir,
        },
      );
    }
    throw error;
  }
}

/**
 * Reads a fiddle folder's top-level regular files (never symlinks or
 * folders) through `pickFiddleFiles`. Unsupported files aren't read.
 */
export async function readFiddleFolder(dir: string): Promise<FolderReadResult> {
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
  );
  return { ...picked, skipped: [...skipped, ...picked.skipped] };
}

/** The name rules of `files.ts`, plus `package.json`. Names that differ only in case are refused. */
function assertWritableNames(names: readonly string[]): void {
  const seen: string[] = [];
  for (const name of names) {
    if (name !== PACKAGE_JSON) assertValidFileName(name);
    if (hasName(seen, name)) throw fileRuleError('duplicate-name', name);
    seen.push(name);
  }
}

/**
 * What `writeFiddleFolder(dir, files)` would replace or delete in `dir`, for
 * the overwrite warning: the names in `files` and `.gitignore`, matched
 * ignoring case. Empty if `dir` doesn't exist.
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
 * Writes a fiddle to `dir`: empty files are deleted from disk (unless
 * `keepEmpty`) and `.gitignore` is written every time. `remove` names files
 * the fiddle no longer has. Deletes come after the writes, so a failure
 * leaves the old files, except for a removed name that only differs in case
 * from a written one: that goes first, so a case-only rename ends with the new
 * name. All names are checked first.
 */
export async function writeFiddleFolder(
  dir: string,
  files: FileMap,
  remove: readonly string[] = [],
  { keepEmpty = false }: { keepEmpty?: boolean } = {},
): Promise<void> {
  const entries = Object.entries(files);
  assertWritableNames(entries.map(([name]) => name));
  assertWritableNames(remove);
  await mkdir(dir, { recursive: true });
  const written = entries.filter(([, content]) => keepEmpty || content !== '');
  const names = written.map(([name]) => name);
  const early = remove.filter((name) => hasName(names, name));
  for (const name of early) await rm(path.join(dir, name), RM_OPTIONS);
  for (const [name, content] of written) await writeAtomic(path.join(dir, name), content);
  await writeAtomic(path.join(dir, GITIGNORE), GITIGNORE_CONTENT);
  const late = [
    ...remove.filter((name) => !early.includes(name)),
    ...entries
      .filter(([, content]) => !keepEmpty && content === '')
      .map(([name]) => name),
  ];
  // rm removes a symlink itself, not what it points to.
  for (const name of late) await rm(path.join(dir, name), RM_OPTIONS);
}

/**
 * The local path of a dropped `file:` URL, or undefined if it could reach
 * another machine: a host (the URL parser turns `localhost` into none) or a UNC
 * path such as `\\server\share` or `//server/share`.
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
