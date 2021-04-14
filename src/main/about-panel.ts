import * as fs from 'fs-extra';
import * as path from 'path';
import { app } from 'electron';

/**
 * Sets Fiddle's About panel options on Linux and macOS
 *
 * @returns
 */
export function setupAboutPanel(): void {
  const contribFile = path.join(__dirname, '../../../static/contributors.json');
  const iconPath = path.resolve(__dirname, '../../../assets/icons/fiddle.png');

  app.setAboutPanelOptions({
    applicationName: 'Electron Fiddle',
    applicationVersion: app.getVersion(),
    authors: fs
      .readJSONSync(contribFile)
      .map(({ name }: { name: string }) => name),
    copyright: '© Electron Authors',
    credits: 'https://github.com/electron/fiddle/graphs/contributors',
    iconPath,
    version: process.versions.electron,
    website: 'https://electronjs.org/fiddle',
  });
}
