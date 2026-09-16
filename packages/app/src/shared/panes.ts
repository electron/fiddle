/**
 * Editor panes (REQUIREMENTS §17.2): one row of side-by-side panes, each
 * showing one visible file, no file in two panes. `Window.layout.panes` lists
 * their files from the start; fewer than two entries means the editor isn't
 * split. `fiddle.activeFile` is the focused pane's file. Pure; shared by main
 * (which keeps the panes in step with the active file) and the renderer.
 */

/** At most this many editor panes side by side. */
export const MAX_PANES = 4;

/** Where a tab lands on a pane: a new pane before it, in it, or a new pane after it. */
export type PaneDropPosition = 'before' | 'center' | 'after';

function unique(names: readonly string[]): string[] {
  return [...new Set(names)];
}

/** Fewer than two panes is stored as "not split". */
function stored(panes: readonly string[]): string[] {
  return panes.length > 1 ? [...panes] : [];
}

/**
 * The panes to draw, from the start: the stored panes that are visible files,
 * at most `MAX_PANES`, always including `active` (the focused pane). One entry
 * means the editor isn't split; none, that no file is open.
 */
export function shownPanes(panes: readonly string[], visible: readonly string[], active: string | null): string[] {
  if (active === null) return [];
  const shown = unique(panes)
    .filter((name) => visible.includes(name))
    .slice(0, MAX_PANES);
  if (shown.length < 2) return [active];
  // Main keeps the focused pane on the active file; if a stale layout doesn't show it, the first pane does.
  return shown.includes(active) ? shown : [active, ...shown.slice(1)];
}

/**
 * `panes` after the active file changed from `previous` to `next`: a file with
 * no pane takes over the focused pane (the one showing `previous`), and files
 * that are no longer visible leave. Returns `panes` itself when nothing changed.
 */
export function followActiveFile(
  panes: readonly string[],
  previous: string | null,
  next: string | null,
  visible: readonly string[],
): readonly string[] {
  if (panes.length === 0) return panes;
  let result = [...panes];
  if (next !== null && !result.includes(next) && previous !== null && result.includes(previous)) {
    result = result.map((name) => (name === previous ? next : name));
  }
  result = stored(unique(result).filter((name) => visible.includes(name)));
  return result.length === panes.length && result.every((name, i) => name === panes[i]) ? panes : result;
}

/**
 * A tab dropped on pane `index` of the shown `panes`: in its centre the file
 * takes that pane over; on an edge it opens in a new pane on that side. A file
 * already showing moves there, so its old pane closes.
 */
export function dropOnPane(
  panes: readonly string[],
  name: string,
  index: number,
  position: PaneDropPosition,
): string[] {
  const target = panes[index];
  if (target === undefined || target === name) return [...panes];
  const rest = panes.filter((pane) => pane !== name);
  const at = rest.indexOf(target);
  if (position === 'center') rest[at] = name;
  else rest.splice(position === 'before' ? at : at + 1, 0, name);
  return rest;
}

/** The shown `panes` without `name`'s pane. */
export function closePane(panes: readonly string[], name: string): string[] {
  return panes.filter((pane) => pane !== name);
}

/** The pane that takes focus when the focused pane `name` closes: its neighbour after it, else before it. */
export function neighbourOf(panes: readonly string[], name: string): string | null {
  const index = panes.indexOf(name);
  if (index === -1) return null;
  return panes[index + 1] ?? panes[index - 1] ?? null;
}

/** What to store as `layout.panes` for the shown `panes`. */
export function storedPanes(panes: readonly string[]): string[] {
  return stored(panes);
}
