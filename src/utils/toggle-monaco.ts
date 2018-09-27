/**
 * Returns the opposite of a Monaco-style boolean.
 *
 * @param {(boolean | string)} input
 * @returns {(boolean | string)}
 */
export function toggleMonaco(input: boolean | string): boolean | string {
  if (input === 'off') return 'on';
  if (input === 'on') return 'off';

  return !input;
}
