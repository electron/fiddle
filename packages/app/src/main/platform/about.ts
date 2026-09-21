import path from 'node:path';

import { app } from 'electron';

import contributors from '../../../static/contributors.json';
import { tm } from '../i18n';

const WEBSITE = 'https://electronjs.org/fiddle';
const CONTRIBUTORS_PAGE = 'https://github.com/electron/fiddle/graphs/contributors';

export function setupAboutPanel(): void {
  const tp = tm('mainPlatform');
  const names = contributors.contributors.map((person) => person.login);
  // Linux only, and read from disk: forge.config.ts ships the file in `extraResource`.
  const icon = app.isPackaged
    ? path.join(process.resourcesPath, 'fiddle.png')
    : path.join(app.getAppPath(), 'assets', 'icons', 'fiddle.png');
  const isMac = process.platform === 'darwin';
  app.setAboutPanelOptions({
    applicationName: app.getName(),
    // macOS shows `version` as the build number, "1.0.0 (44.3.0)"; elsewhere both go in one line.
    applicationVersion: isMac
      ? app.getVersion()
      : tp('aboutVersion', {
          version: app.getVersion(),
          electron: process.versions.electron,
        }),
    version: process.versions.electron,
    copyright: tp('aboutCopyright'),
    // `credits` is macOS-only; `authors` and `website` are Linux-only.
    credits: names.length ? names.join(', ') : CONTRIBUTORS_PAGE,
    authors: names,
    website: WEBSITE,
    iconPath: icon,
  });
}
