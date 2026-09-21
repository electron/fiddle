import fs from 'node:fs';
import path from 'node:path';

import { app, dialog } from 'electron';

import contributors from '../../../static/contributors.json';
import { applyCrashReportsSetting } from '../crash/sentry';
import { tm } from '../i18n';
import { log } from '../log';
import { importElectronVersionsInBackground } from '../migration';
import type { StateHub } from '../state-hub';
import { isTestMode, testFlags } from '../test-mode';
import { startUpdates } from '../updates';
import { PROTOCOL, squirrelStubPath } from './squirrel';

const WEBSITE = 'https://electronjs.org/fiddle';
const CONTRIBUTORS_PAGE = 'https://github.com/electron/fiddle/graphs/contributors';

/** `window-all-closed` is ignored until startup has finished: the import's hidden reader window is the only window until then, and destroying it would quit Linux and Windows. */
let starting = true;

export function installQuitOnLastWindowClosed(platform = process.platform): void {
  app.on('window-all-closed', () => {
    if (platform !== 'darwin' && !starting) app.quit();
  });
}

/** `firstLaunch`: from the one-time import, no earlier launch of this app. App windows may open from now on; closing the last one quits (outside macOS). */
export async function startPlatform(hub: StateHub, firstLaunch: boolean): Promise<void> {
  starting = false;
  setupAboutPanel();
  registerProtocolClient();
  hub.onChange(() => {
    const crashReporting = applyCrashReportsSetting(hub.app.settings.crashReports);
    if (crashReporting !== hub.app.crashReporting) hub.updateApp({ crashReporting });
  });
  await offerMoveToApplications(firstLaunch);
  startUpdates((version) => hub.updateApp({ updateAvailable: version }));
  importElectronVersionsInBackground();
}

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

/** Claims electron-fiddle://. Skipped in dev and test mode, so a dev build never takes over the protocol. */
export function registerProtocolClient(): void {
  if (!app.isPackaged || isTestMode()) return;
  try {
    if (process.platform === 'win32') {
      // MSIX declares the protocol in its manifest. Squirrel registers the stub, and
      // only if it exists, so a portable copy never takes the protocol over.
      if (process.windowsStore) return;
      const stub = squirrelStubPath();
      if (!fs.existsSync(stub)) return;
      if (!app.isDefaultProtocolClient(PROTOCOL, stub))
        app.setAsDefaultProtocolClient(PROTOCOL, stub);
      return;
    }
    if (!app.isDefaultProtocolClient(PROTOCOL)) app.setAsDefaultProtocolClient(PROTOCOL);
  } catch (error) {
    log.warn('registering the electron-fiddle:// protocol failed', error);
  }
}

/** macOS, first launch of a packaged app outside /Applications: offers to move it there. */
export async function offerMoveToApplications(firstLaunch: boolean): Promise<void> {
  if (process.platform !== 'darwin' || !firstLaunch) return;
  if (!app.isPackaged || !testFlags().firstRunPrompts || app.isInApplicationsFolder())
    return;
  const tp = tm('mainPlatform');
  const { response } = await dialog.showMessageBox({
    type: 'question',
    message: tp('moveMessage'),
    detail: tp('moveDetail'),
    buttons: [tp('moveButton'), tp('dontMove')],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });
  if (response !== 0) return;
  try {
    // Quits and relaunches from /Applications when it succeeds.
    app.moveToApplicationsFolder();
  } catch (error) {
    log.error('moving the app to /Applications failed', error);
  }
}
