import * as path from 'path';

import { remote } from 'electron';

let appData = '';

/**
 * Returns an appData path for a given input
 *
 * @param input {string}
 * @returns {string}
 */
export function getAppDataDir(input: string): string {
  appData = appData || remote.app.getPath('appData');
  return path.join(appData, input);
}
