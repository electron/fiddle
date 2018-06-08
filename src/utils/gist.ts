/**
 * Get the id of a gist from a url
 *
 * @param {string} input
 * @returns {(string | null)}
 */
export function idFromUrl(input: string): string | null {
  let gistMatch = input.match(/https:\/\/gist\.github\.com\/([^\/]+)$/);

  if (!gistMatch || !gistMatch[1]) {
    gistMatch = input.match(/https:\/\/gist\.github\.com\/[^\/]+\/([^\/]+)$/);
    if (!gistMatch || !gistMatch[1]) return null;
  }

  return gistMatch[1];
}

/**
 * Get the url for a gist id
 *
 * @param {string} input
 * @returns {string}
 */
export function urlFromId(input: string): string {
  return `https://gist.github.com/${input}`;
}
