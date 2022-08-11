/**
 * Returns the correct name of ELectron for the current platform
 *
 * @returns {string}
 */
export function getElectronNameForPlatform(): string {
  switch (process.platform) {
    case 'win32': {
      return 'electron.exe';
    }
    case 'darwin': {
      return 'Electron.app';
    }
    default: {
      return 'electron';
    }
  }
}
