import { AboutPanelOptionsOptions, app } from 'electron';

/**
 * Sets Fiddle's About panel options on Linux and macOS
 *
 * @returns
 */
export function setupAboutPanel(): void {
  if (process.platform === 'win32') return;

  const options: AboutPanelOptionsOptions = {
    applicationName: 'Electron Fiddle',
    applicationVersion: app.getVersion(),
    version: process.versions.electron,
    copyright: '© Electron Authors',
  };

  switch (process.platform) {
    case 'linux':
      options.website = 'https://electronjs.org/fiddle';
    case 'darwin':
      options.credits = 'https://github.com/electron/fiddle/graphs/contributors';
    default:
      // fallthrough
  }

  app.setAboutPanelOptions(options);
}
