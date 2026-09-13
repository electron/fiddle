/**
 * Which Electron process a fiddle file belongs to, for the sidebar sections,
 * the tab row's process label and the split view. Pure; no DOM.
 */
import { isMainEntry } from '../../fiddle/files';

export type FileProcess = 'main' | 'preload' | 'renderer';

export const PROCESS_ORDER: readonly FileProcess[] = ['main', 'preload', 'renderer'];

const PRELOAD_RE = /^preload\.(c|m)?js$/i;

export function processOf(name: string): FileProcess {
  if (isMainEntry(name)) return 'main';
  if (PRELOAD_RE.test(name)) return 'preload';
  return 'renderer';
}

/** Groups files by process, keeping their order. Every process is present, possibly empty. */
export function groupByProcess<T extends { name: string }>(
  files: readonly T[],
): Record<FileProcess, T[]> {
  const groups: Record<FileProcess, T[]> = { main: [], preload: [], renderer: [] };
  for (const file of files) groups[processOf(file.name)].push(file);
  return groups;
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
