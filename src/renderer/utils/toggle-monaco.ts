/**
 * Returns the opposite of a Monaco-style boolean.
 */
export function toggleMonaco(input: boolean | string): boolean | string {
  if (input === 'off') return 'on';
  if (input === 'on') return 'off';

  return !input;
}
