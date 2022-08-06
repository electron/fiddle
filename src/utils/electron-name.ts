/**
 * Returns the correct name of ELectron for the current platform
 *
 * @returns {string}
 */
export function getElectronNameForPlatform(): string {
  if (process.platform === 'win32') {
    return 'electron.exe';
  }

  if (process.platform === 'darwin') {
    return 'Electron.app';
  }

  return 'electron';
}
