import * as path from 'path';

import { app } from 'electron';

import { Contributor } from 'src/interfaces';

import contributorsJSON from '../../static/contributors.json';

/**
 * Sets Fiddle's About panel options on Linux and macOS
 *
 * @returns
 */
export function setupAboutPanel(): void {
  const contributors: Array<string> = [];
  contributorsJSON.forEach((userData: Contributor) => {
    if (userData.name !== null && userData.name !== undefined) {
      contributors.push(userData.name);
    }
  });

  const iconPath = path.resolve(__dirname, '../assets/icons/fiddle.png');

  app.setAboutPanelOptions({
    applicationName: 'Electron Fiddle',
    applicationVersion: app.getVersion(),
    authors: contributors,
    copyright: '© Electron Authors',
    credits: 'https://github.com/electron/fiddle/graphs/contributors',
    iconPath,
    version: process.versions.electron,
    website: 'https://electronjs.org/fiddle',
  });
}
