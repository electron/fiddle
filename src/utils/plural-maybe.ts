/**
 * Takes a word and an array. If the array has more than one entry,
 * it attaches a plural "s".
 *
 * @param {string} word
 * @param {Array<any>} input
 * @returns {string}
 */
export function maybePlural(word: string, input: Array<any>): string {
  if (input && input.length && input.length > 1) {
    return `${word}s`;
  }

  return word;
}
