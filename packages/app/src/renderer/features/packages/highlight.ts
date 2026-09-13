export interface TextPart {
  text: string;
  match: boolean;
}

/** Splits `text` around case-insensitive occurrences of `query`, for highlighting. */
export function highlightParts(text: string, query: string): TextPart[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return [{ text, match: false }];
  const parts: TextPart[] = [];
  const lower = text.toLowerCase();
  let from = 0;
  for (let index = lower.indexOf(needle); index !== -1; index = lower.indexOf(needle, from)) {
    if (index > from) parts.push({ text: text.slice(from, index), match: false });
    parts.push({ text: text.slice(index, index + needle.length), match: true });
    from = index + needle.length;
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false });
  return parts;
}
