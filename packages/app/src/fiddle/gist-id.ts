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
  if (isGistId(value)) return value.toLowerCase();
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (
      url.hostname.toLowerCase() !== 'gist.github.com' ||
      url.username ||
      url.password ||
      url.port
    )
      return null;
    // `/<id>` or `/<user>/<id>`, optionally followed by a revision SHA and a slash.
    // Only the canonical URL comes back: no userinfo, query, fragment or revision,
    // so what the field shows is exactly what getGistId() will load.
    const match =
      /^\/(?:([a-z\d](?:[a-z\d-]{0,38})?)\/)?([\da-f]{32})(?:\/[\da-f]{40})?\/?$/i.exec(
        url.pathname,
      );
    if (!match) return null;
    const [, user, id] = match;
    return gistUrl(user ? `${user}/${id!.toLowerCase()}` : id!.toLowerCase());
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
