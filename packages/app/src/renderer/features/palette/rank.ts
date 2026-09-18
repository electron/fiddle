/**
 * Filtering and ranking for the command palette. Pure functions, so the
 * palette component only renders what these return.
 */

export type PaletteKind = 'command' | 'editor' | 'file' | 'version' | 'example';

export interface PaletteItem {
  /** Unique across kinds, e.g. `command:app.newWindow` or `file:main.js`. */
  id: string;
  kind: PaletteKind;
  label: string;
  /** Secondary text, such as a version's channel. */
  detail?: string;
  /** Extra words that match but aren't shown. */
  keywords?: string[];
  /** Key caps for the current shortcut. */
  keys?: string[];
  isDisabled?: boolean;
}

/** Kinds listed before the user types. Everything is searchable. */
const IDLE_KINDS: ReadonlySet<PaletteKind> = new Set(['command', 'editor']);

const isWordStart = (text: string, index: number) =>
  index === 0 ||
  /[\s._\-/:@()]/.test(text[index - 1] ?? '') ||
  /[a-z][A-Z]/.test(text.slice(index - 1, index + 1));

/**
 * How well `query` matches `text`, or null if it doesn't. Substrings beat
 * scattered letters; matches at a word start and near the front score higher.
 */
export function matchScore(query: string, text: string): number | null {
  const q = query.trim().toLowerCase();
  if (q === '') return 0;
  const lower = text.toLowerCase();

  const index = lower.indexOf(q);
  if (index !== -1) {
    let score = 1000 - index;
    if (isWordStart(text, index)) score += 200;
    if (lower.length === q.length) score += 300;
    return score;
  }

  // Every query character, in order (spaces ignored).
  let score = 0;
  let from = 0;
  let previous = -2;
  for (const char of q.replace(/\s+/g, '')) {
    const found = lower.indexOf(char, from);
    if (found === -1) return null;
    score += 10;
    if (found === previous + 1) score += 15;
    if (isWordStart(text, found)) score += 25;
    previous = found;
    from = found + 1;
  }
  return score - lower.length;
}

function itemScore(query: string, item: PaletteItem): number | null {
  let best = matchScore(query, item.label);
  for (const text of [item.detail, ...(item.keywords ?? [])]) {
    if (!text) continue;
    const score = matchScore(query, text);
    // Hidden or secondary text matches, but less than the label.
    if (score !== null && (best === null || score / 2 > best)) best = score / 2;
  }
  return best;
}

/**
 * The items to show for `query`, best first.
 * - Empty query: recently used items (most recent first), then the other
 *   commands in registry order. Files, versions and examples wait for a query.
 * - Otherwise: every matching item by score. Recently used items get a boost.
 *   Ties keep the input order.
 */
export function rankItems<T extends PaletteItem>(
  items: readonly T[],
  query: string,
  recent: readonly string[],
  limit = 50,
): T[] {
  const recency = new Map(recent.map((id, i) => [id, recent.length - i]));

  if (query.trim() === '') {
    const byId = new Map(items.map((item) => [item.id, item]));
    const first = recent.map((id) => byId.get(id)).filter((item) => item !== undefined);
    const rest = items.filter(
      (item) => IDLE_KINDS.has(item.kind) && !recency.has(item.id),
    );
    return [...first, ...rest].slice(0, limit);
  }

  const scored: { item: T; score: number; order: number }[] = [];
  items.forEach((item, order) => {
    const score = itemScore(query, item);
    if (score === null) return;
    scored.push({ item, score: score + (recency.get(item.id) ?? 0) * 40, order });
  });
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  return scored.slice(0, limit).map((entry) => entry.item);
}

/** Adds `id` to the front of the recent list, without duplicates. */
export function pushRecent(recent: readonly string[], id: string, max = 8): string[] {
  return [id, ...recent.filter((other) => other !== id)].slice(0, max);
}
