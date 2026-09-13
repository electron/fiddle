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

export function isRevisionSha(value: string): boolean {
  return SHA_RE.test(value);
}

export function gistUrl(id: string): string {
  return `https://gist.github.com/${id}`;
}
