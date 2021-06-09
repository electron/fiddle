/**
 * Get the gist ID from a string.
 *
 * Understands these formats:
 *-  8C5FC0C6A5153D49B5A4A56D3ED9DA8F
 *-  8c5fc0c6a5153d49b5a4a56d3ed9da8f
 *-  https://gist.github.com/8c5fc0c6a5153d49b5a4a56d3ed9da8f
 *-  https://gist.github.com/8c5fc0c6a5153d49b5a4a56d3ed9da8f/
 *-  https://gist.github.com/ckerr/8c5fc0c6a5153d49b5a4a56d3ed9da8f
 *-  https://gist.github.com/ckerr/8c5fc0c6a5153d49b5a4a56d3ed9da8f/
 *
 * @pararm {string} rawInput
 * returns {(string | null)}
 */
export function getGistId(rawInput: string): string | null {
  let input = rawInput.trim();

  let id = input;
  if (input.startsWith('https://gist.github.com')) {
    if (input.endsWith('/')) {
      input = input.slice(0, -1);
    }
    id = input.split('/').pop()!;
  }

  return id.match(/[0-9A-Fa-f]{32}/) ? id : null;
}

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
