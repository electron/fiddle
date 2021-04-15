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
 * @pararm {string} input
 * returns {(string | null)}
 */
export function getGistId(input: string): string | undefined {
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
  return undefined;
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
