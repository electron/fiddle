import * as os from 'os';

/**
 * Returns the current username
 *
 * @export
 * @returns {string}
 */
export const getUsername = (() => {
  let username = '';

  return (): string => {
    if (!username) {
      username = os.userInfo().username;
    }

    return username;
  };
})();
