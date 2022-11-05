import * as path from 'path';

import namor from 'namor';

import { AppState } from '../renderer/state';

/**
 * Returns a name for this project
 *
 * @param {AppState} appState
 * @returns {Promise<string>}
 */
export function getName(appState: AppState) {
  if (appState.localPath) {
    return path.basename(appState.localPath);
  }

  return namor.generate({ words: 3, numbers: 0 });
}
