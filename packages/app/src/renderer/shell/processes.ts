/**
 * Which sidebar group a fiddle file belongs to, for the sidebar sections, the
 * tab row's process label and the split view. Pure; no DOM.
 *
 * Groups are inferred from names alone:
 * - main: the main entry, and helper scripts named `main-*` or `main.*`;
 * - preload: `preload.{js,cjs,mjs}` and scripts named `preload-*` or `preload.*`;
 * - renderer: every `.html` and `.css` file, `renderer.{js,cjs,mjs}` and
 *   scripts named `renderer-*` or `renderer.*`;
 * - other: everything else, such as JSON files and `utils.js`.
 * Only `isMainEntry` names count as the main entry; `main-menu.js` is a helper.
 */
import { assertCanAddFile } from '../../fiddle/files';

export type FileProcess = 'main' | 'preload' | 'renderer' | 'other';

export const PROCESS_ORDER: readonly FileProcess[] = [
  'main',
  'preload',
  'renderer',
  'other',
];

/** The groups a script's name can claim, in matching order. */
const NAMED_GROUPS = ['main', 'preload', 'renderer'] as const;
const SCRIPT_RE = /^(.*)\.[cm]?js$/;
const PAGE_RE = /\.(html|css)$/;

/** A script `<group>.js`, `<group>-*.js` or `<group>.*.js` belongs to that group. */
function claims(stem: string, group: string): boolean {
  return stem === group || stem.startsWith(`${group}-`) || stem.startsWith(`${group}.`);
}

/** Case-insensitive, like the file rules: `Preload.JS` is a preload script. */
export function processOf(name: string): FileProcess {
  const lower = name.toLowerCase();
  if (PAGE_RE.test(lower)) return 'renderer';
  const stem = SCRIPT_RE.exec(lower)?.[1];
  if (stem === undefined) return 'other';
  return NAMED_GROUPS.find((group) => claims(stem, group)) ?? 'other';
}

/** Groups files by process, keeping their order. Every process is present, possibly empty. */
export function groupByProcess<T extends { name: string }>(
  files: readonly T[],
): Record<FileProcess, T[]> {
  const groups: Record<FileProcess, T[]> = {
    main: [],
    preload: [],
    renderer: [],
    other: [],
  };
  for (const file of files) groups[processOf(file.name)].push(file);
  return groups;
}

function canAdd(existing: readonly string[], name: string): boolean {
  try {
    assertCanAddFile(existing, name);
    return true;
  } catch {
    return false;
  }
}

/**
 * The name the "add file" prompt of a group starts with: the group's own name
 * (`preload.js`), or, when the file rules refuse that (it exists, or it would
 * be a second main entry), the first free `preload-2.js`, `preload-3.js`, ….
 * Other has no naming convention, so its prompt starts empty.
 */
export function suggestFileName(
  process: FileProcess,
  existing: readonly string[],
): string {
  if (process === 'other') return '';
  if (canAdd(existing, `${process}.js`)) return `${process}.js`;
  for (let n = 2; ; n += 1) {
    const name = `${process}-${n}.js`;
    if (canAdd(existing, name)) return name;
  }
}

/**
 * The file a new split pane shows: renderer.js, or main.js when renderer.js is
 * current. Falls back to the first other file, and null when there is none.
 */
export function splitTarget(
  current: string | null,
  names: readonly string[],
): string | null {
  const preferred = current === 'renderer.js' ? 'main.js' : 'renderer.js';
  if (preferred !== current && names.includes(preferred)) return preferred;
  return names.find((name) => name !== current) ?? null;
}
