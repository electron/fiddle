/**
 * Get the id of a gist from a url
 *
 * @param {string} input
 * @returns {(string | null)}
 */
export function idFromUrl(input: string): string | null {
  return getGistId(input);
}

/**
 * Get the url for a gist id
 *
 * @param {string} input
 * @returns {string}
 */
export function urlFromId(input?: string): string {
  return input ? `https://gist.github.com/${input}` : '';
}

/**
 * Get the gist ID from a string.
 *
 * Understands these formats:
 * - AF3E1A018F5DCCE4A2FF40004EF5BAB5
 * - af3e1a018f5dcce4a2ff40004ef5bab5
 * - https://gist.github.com/af3e1a018f5dcce4a2ff40004ef5bab5
 * - https://gist.github.com/af3e1a018f5dcce4a2ff40004ef5bab5/
 * - https://gist.github.com/ckerr/af3e1a018f5dcce4a2ff40004ef5bab5
 * - https://gist.github.com/ckerr/af3e1a018f5dcce4a2ff40004ef5bab5/
 *
 * @pararm {string} input
 * returns {(string | null)}
 */
export function getGistId(input: string): string | null {
  let id: string | undefined = input;
  if (input.startsWith('https://gist.github.com')) {
    if (input.endsWith('/')) {
      input = input.slice(0, -1);
    }
    id = input.split('/').pop();
  }
  if (id && id.match(/[0-9A-Fa-f]{32}/)) {
    return id;
  }
  return null;
}
