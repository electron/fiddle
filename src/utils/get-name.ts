import { AppState } from '../renderer/state';

/**
 * Returns a name for this project
 *
 * @param {AppState} appState
 * @returns {Promise<string>}
 */
export async function getName(appState: AppState): Promise<string> {
  if (appState.localPath) {
    const path = await import('path');
    return path.basename(appState.localPath);
  }

  const namor = await import('namor');
  return namor.generate({ words: 3, numbers: 0 });
}
