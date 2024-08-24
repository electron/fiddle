/**
 * Returns the correct name of ELectron for the current platform
 */
export function getElectronNameForPlatform(): string {
  switch (window.ElectronFiddle.platform) {
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
