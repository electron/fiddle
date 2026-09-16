const GIST_ID_RE = /^[0-9a-f]{32}$/i;
const SHA_RE = /^[0-9a-f]{40}$/i;

/**
 * The first 32-hex-character substring of the input, lower-cased, or null.
 * Accepts a bare ID or any gist URL (`gist.github.com/[user/]<id>`).
 */
export function getGistId(input: string): string | null {
  const match = /[0-9a-f]{32}/i.exec(input.trim());
  return match ? match[0].toLowerCase() : null;
}

export function isGistId(value: string): boolean {
  return GIST_ID_RE.test(value);
}

/**
 * The input, trimmed, when all of it is a gist reference: a bare ID or a
 * `gist.github.com` URL with an ID in its path. Stricter than `getGistId`,
 * for text nobody typed into the field, such as the clipboard's. Null otherwise.
 */
export function asGistReference(input: string): string | null {
  const value = input.trim();
  // Documents.LoadGist takes at most 2048 characters (ShortText).
  if (value === '' || value.length > 2048 || /\s/.test(value)) return null;
  if (isGistId(value)) return value;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.hostname === 'gist.github.com' && getGistId(url.pathname) !== null ? value : null;
  } catch {
    return null;
  }
}

export function isRevisionSha(value: string): boolean {
  return SHA_RE.test(value);
}

export function gistUrl(id: string): string {
  return `https://gist.github.com/${id}`;
}
