export type FileProcess = 'main' | 'preload' | 'renderer' | 'other';

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
