import { AppState } from '../renderer/state';

/**
 * Returns the window title
 *
 * @param {AppState} appState
 * @returns {string}
 */
export function getTitle(appState: AppState): string {
  const { gistId, localPath } = appState;
  const gist = gistId ? `gist.github.com/${appState.gistId}` : '';
  const local = localPath ? localPath : '';
  const separator = gist && local ? ' ' : '';
  const unsaved = !gist && !local ? 'Unsaved' : '';

  return `Electron Fiddle - ${gist}${separator}${local}${unsaved}`;
}

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
  } else {
    const namor = await import('namor');
    return namor.generate({ words: 3, numbers: 0 });
  }
}
