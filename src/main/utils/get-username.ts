import * as os from 'node:os';

/**
 * Returns the current username
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
