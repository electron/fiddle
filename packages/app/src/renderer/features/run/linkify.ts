/** Splits a console line into text and http(s) URLs, so the URLs can be links. */
export interface Segment {
  text: string;
  /** Set when this segment is a URL. */
  url?: string;
}

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"'`]+/g;
/** Sentence punctuation after a URL isn't part of it. */
const TRAILING = /[.,;:!?)\]}]+$/;

export function linkify(text: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    let url = match[0];
    const trailing = TRAILING.exec(url)?.[0] ?? '';
    // Keep a closing paren that belongs to the URL, as in Wikipedia links.
    const keep = trailing.startsWith(')') && url.includes('(') ? 1 : 0;
    url = url.slice(0, url.length - trailing.length + keep);
    if (url.length <= 'https://'.length) continue;
    const start = match.index;
    if (start > last) segments.push({ text: text.slice(last, start) });
    segments.push({ text: url, url });
    last = start + url.length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments;
}
