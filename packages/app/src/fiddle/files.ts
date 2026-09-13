import { ErrorCode, FiddleError } from '../shared/errors';

/** A fiddle's files: name → content. Build with `Object.fromEntries`, never by key assignment from untrusted names. */
export type FileMap = Record<string, string>;

export const SUPPORTED_EXTENSIONS = ['.cjs', '.js', '.mjs', '.html', '.css', '.json'] as const;
export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

export const MAIN_ENTRY_NAMES = ['main.js', 'main.cjs', 'main.mjs'] as const;
export const DEFAULT_MAIN_ENTRY = 'main.js';
export const PACKAGE_JSON = 'package.json';
export const PACKAGE_LOCK_JSON = 'package-lock.json';
export const RESERVED_FILE_NAMES = [PACKAGE_JSON, PACKAGE_LOCK_JSON] as const;

export type EditorLanguage = 'javascript' | 'html' | 'css' | 'json';

/** Why a file name or file operation was refused. Carried in `FiddleError.details.reason`. */
export type FileRuleViolation =
  | 'empty-name'
  | 'path-separator'
  | 'unsupported-extension'
  | 'reserved-name'
  | 'duplicate-name'
  | 'second-main-entry'
  | 'no-main-entry'
  | 'remove-main-entry'
  | 'file-not-found';

/**
 * Known files, in display order. Everything else sorts after these,
 * alphabetically.
 */
export const KNOWN_FILES: readonly string[] = [
  'main.cjs',
  'main.js',
  'main.mjs',
  'renderer.cjs',
  'renderer.js',
  'renderer.mjs',
  'index.html',
  'preload.cjs',
  'preload.js',
  'preload.mjs',
  'styles.css',
];

const PLACEHOLDERS: Record<SupportedExtension, string> = {
  '.cjs': '// Empty',
  '.js': '// Empty',
  '.mjs': '// Empty',
  '.html': '<!-- Empty -->',
  '.css': '/* Empty */',
  '.json': '{}',
};

const SUPPORTED_RE = /\.(cjs|js|mjs|html|css|json)$/i;

export function fileRuleError(reason: FileRuleViolation, name: string): FiddleError {
  const code = reason === 'file-not-found' ? ErrorCode.notFound : ErrorCode.invalidArgument;
  return new FiddleError(code, `File "${name}" breaks the rule: ${reason}`, { reason, name });
}

/** The lower-cased extension including the dot, or '' if there is none. */
export function getExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot).toLowerCase();
}

export function hasPathSeparator(name: string): boolean {
  return /[/\\]/.test(name);
}

export function isSupportedFileName(name: string): boolean {
  return (
    name.length > 0 &&
    !hasPathSeparator(name) &&
    !name.includes('\0') &&
    SUPPORTED_RE.test(name) &&
    getExtension(name) !== ''
  );
}

export function isReservedFileName(name: string): boolean {
  return (RESERVED_FILE_NAMES as readonly string[]).includes(name.toLowerCase());
}

export function isMainEntry(name: string): boolean {
  return (MAIN_ENTRY_NAMES as readonly string[]).includes(name);
}

export function findMainEntry(names: Iterable<string>): string | undefined {
  for (const name of names) if (isMainEntry(name)) return name;
  return undefined;
}

export function isKnownFile(name: string): boolean {
  return KNOWN_FILES.includes(name);
}

export function getEditorLanguage(name: string): EditorLanguage {
  switch (getExtension(name)) {
    case '.html':
      return 'html';
    case '.css':
      return 'css';
    case '.json':
      return 'json';
    default:
      return 'javascript';
  }
}

/** The placeholder comment for a new file of this type, or '' for unknown types. */
export function getPlaceholder(name: string): string {
  return PLACEHOLDERS[getExtension(name) as SupportedExtension] ?? '';
}

/** True if the content is empty, whitespace, or exactly the placeholder. Such files load hidden. */
export function isEmptyOrPlaceholder(name: string, content: string): boolean {
  const trimmed = content.trim();
  return trimmed === '' || trimmed === getPlaceholder(name);
}

/** Known files first in `KNOWN_FILES` order, then the rest alphabetically. */
export function compareFileNames(a: string, b: string): number {
  const ia = KNOWN_FILES.indexOf(a);
  const ib = KNOWN_FILES.indexOf(b);
  if (ia === -1 && ib === -1) return a < b ? -1 : a > b ? 1 : 0;
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

export function sortFileNames(names: Iterable<string>): string[] {
  return [...names].sort(compareFileNames);
}

/** Throws unless `name` is a valid editable file name on its own. */
export function assertValidFileName(name: string): void {
  if (name.length === 0) throw fileRuleError('empty-name', name);
  if (hasPathSeparator(name)) throw fileRuleError('path-separator', name);
  if (isReservedFileName(name)) throw fileRuleError('reserved-name', name);
  if (!isSupportedFileName(name)) throw fileRuleError('unsupported-extension', name);
}

function hasName(names: readonly string[], name: string): boolean {
  const lower = name.toLowerCase();
  return names.some((n) => n.toLowerCase() === lower);
}

/** Throws unless `name` can be added next to `existing`. Duplicates are compared case-insensitively. */
export function assertCanAddFile(existing: readonly string[], name: string): void {
  assertValidFileName(name);
  if (hasName(existing, name)) throw fileRuleError('duplicate-name', name);
  if (isMainEntry(name) && findMainEntry(existing)) throw fileRuleError('second-main-entry', name);
}

/** Throws unless `from` can be renamed to `to` among `existing`. */
export function assertCanRenameFile(existing: readonly string[], from: string, to: string): void {
  if (!existing.includes(from)) throw fileRuleError('file-not-found', from);
  assertValidFileName(to);
  const others = existing.filter((n) => n !== from);
  if (hasName(others, to)) throw fileRuleError('duplicate-name', to);
  if (isMainEntry(to) && findMainEntry(others)) throw fileRuleError('second-main-entry', to);
  if (isMainEntry(from) && !isMainEntry(to)) throw fileRuleError('no-main-entry', from);
}

/** Throws unless `name` can be removed. The main entry can't be. */
export function assertCanRemoveFile(existing: readonly string[], name: string): void {
  if (!existing.includes(name)) throw fileRuleError('file-not-found', name);
  if (isMainEntry(name)) throw fileRuleError('remove-main-entry', name);
}

/** Throws unless the set of names is valid as a whole: exactly one main entry, no duplicates. */
export function assertValidFileSet(names: readonly string[]): void {
  const seen: string[] = [];
  for (const name of names) {
    assertValidFileName(name);
    if (hasName(seen, name)) throw fileRuleError('duplicate-name', name);
    seen.push(name);
  }
  const mains = names.filter(isMainEntry);
  if (mains.length === 0) throw fileRuleError('no-main-entry', DEFAULT_MAIN_ENTRY);
  if (mains.length > 1) throw fileRuleError('second-main-entry', mains[1]!);
}

/**
 * Returns the files with a `main.js` holding the JS placeholder added if
 * there's no main entry. The placeholder (rather than '') keeps the file
 * publishable, since GitHub rejects empty gist files; it still counts as empty.
 */
export function ensureMainEntry(files: FileMap): FileMap {
  if (findMainEntry(Object.keys(files))) return files;
  return { ...files, [DEFAULT_MAIN_ENTRY]: getPlaceholder(DEFAULT_MAIN_ENTRY) };
}
