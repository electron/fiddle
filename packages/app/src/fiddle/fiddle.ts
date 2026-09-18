import { z } from 'zod';

import { ErrorCode, FiddleError } from '../shared/errors';
import {
  assertCanAddFile,
  assertCanRemoveFile,
  assertCanRenameFile,
  ensureMainEntry,
  type FileMap,
  getPlaceholder,
  isEmptyOrPlaceholder,
  moveName,
  orderFiles,
  sortFileNames,
} from './files';
import type { FiddleOrigin } from './trust';

export const VersionRefSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('release'), version: z.string() }),
  z.object({ kind: z.literal('local'), id: z.string() }),
]);
export type VersionRef = z.infer<typeof VersionRefSchema>;

/** Where the fiddle is saved or published. */
export interface FiddleSource {
  localPath?: string;
  gistId?: string;
  gistRevision?: string;
}

export interface Fiddle {
  /**
   * The key order is the display order (tabs, and the sidebar within a process):
   * `sortFileNames` order when created, then as the user arranges the tabs (`moveFile`).
   */
  files: FileMap;
  /** Names of hidden files. Hidden files keep their content. */
  hidden: readonly string[];
  version: VersionRef;
  modules: Readonly<Record<string, string>>;
  origin: FiddleOrigin;
  source: FiddleSource;
  /** Set when the fiddle is a template or "Show Me" example. */
  templateName?: string;
}

export interface CreateFiddleInput {
  files: FileMap;
  version: VersionRef;
  modules?: Readonly<Record<string, string>>;
  origin?: FiddleOrigin;
  source?: FiddleSource;
  templateName?: string;
}

/** Builds a fiddle, adding a main entry if needed. Empty or placeholder-only files start hidden. */
export function createFiddle(input: CreateFiddleInput): Fiddle {
  const withMain = ensureMainEntry(input.files);
  const files = orderFiles(withMain, sortFileNames(Object.keys(withMain)));
  const fiddle: Fiddle = {
    files,
    hidden: Object.keys(files).filter((name) => isEmptyOrPlaceholder(name, files[name]!)),
    version: input.version,
    modules: input.modules ?? {},
    origin: input.origin ?? { kind: 'local' },
    source: input.source ?? {},
  };
  if (input.templateName !== undefined) fiddle.templateName = input.templateName;
  return fiddle;
}

function assertHasFile(fiddle: Fiddle, name: string): void {
  if (!Object.hasOwn(fiddle.files, name)) {
    throw new FiddleError(ErrorCode.notFound, `No file named "${name}"`, {
      reason: 'file-not-found',
      name,
    });
  }
}

/** File names in display order. */
export function fileNames(fiddle: Fiddle): string[] {
  return Object.keys(fiddle.files);
}

export function visibleFileNames(fiddle: Fiddle): string[] {
  return fileNames(fiddle).filter((name) => !fiddle.hidden.includes(name));
}

/** Adds a visible file. New files get their language's placeholder. */
export function addFile(
  fiddle: Fiddle,
  name: string,
  content: string = getPlaceholder(name),
): Fiddle {
  assertCanAddFile(Object.keys(fiddle.files), name);
  return { ...fiddle, files: { ...fiddle.files, [name]: content } };
}

export function renameFile(fiddle: Fiddle, from: string, to: string): Fiddle {
  assertCanRenameFile(Object.keys(fiddle.files), from, to);
  return {
    ...fiddle,
    files: Object.fromEntries(
      Object.entries(fiddle.files).map(([n, c]) => [n === from ? to : n, c]),
    ),
    hidden: fiddle.hidden.map((n) => (n === from ? to : n)),
  };
}

export function removeFile(fiddle: Fiddle, name: string): Fiddle {
  assertCanRemoveFile(Object.keys(fiddle.files), name);
  return {
    ...fiddle,
    files: Object.fromEntries(Object.entries(fiddle.files).filter(([n]) => n !== name)),
    hidden: fiddle.hidden.filter((n) => n !== name),
  };
}

export function hideFile(fiddle: Fiddle, name: string): Fiddle {
  assertHasFile(fiddle, name);
  return fiddle.hidden.includes(name)
    ? fiddle
    : { ...fiddle, hidden: [...fiddle.hidden, name] };
}

export function showFile(fiddle: Fiddle, name: string): Fiddle {
  assertHasFile(fiddle, name);
  return { ...fiddle, hidden: fiddle.hidden.filter((n) => n !== name) };
}

/** Moves `name` in the display order: in front of `before`, or to the end when `before` is null. */
export function moveFile(fiddle: Fiddle, name: string, before: string | null): Fiddle {
  assertHasFile(fiddle, name);
  if (before !== null) assertHasFile(fiddle, before);
  const names = fileNames(fiddle);
  const moved = moveName(names, name, before);
  if (moved.every((n, i) => n === names[i])) return fiddle;
  return { ...fiddle, files: orderFiles(fiddle.files, moved) };
}

export function setFileContent(fiddle: Fiddle, name: string, content: string): Fiddle {
  assertHasFile(fiddle, name);
  return { ...fiddle, files: { ...fiddle.files, [name]: content } };
}

/** True if both maps hold the same names with the same content (hidden files included). */
export function sameFiles(a: FileMap, b: FileMap): boolean {
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((k) => Object.hasOwn(b, k) && a[k] === b[k])
  );
}
