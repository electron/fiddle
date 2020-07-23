import * as os from 'os';

let username = '';

/**
 * Returns the curren username
 *
 * @export
 * @returns {string}
 */
export function getUsername(): string {
  return (username = username || os.userInfo().username);
}
