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
