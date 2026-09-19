/**
 * Updates. Off in dev (unpackaged) and test mode.
 *
 * - macOS and Windows (Squirrel): `update-electron-app` against
 *   update.electronjs.org for electron/fiddle, every hour, first 10 s after
 *   launch.
 * - Linux and MSIX: no auto-update. The GitHub releases API is checked once a
 *   day, and an "Update available" toast goes to the windows through the
 *   `AppPlatform.UpdateAvailable` event.
 */
import { app, BrowserWindow, net } from 'electron';
import {
  makeUserNotifier,
  updateElectronApp,
  UpdateSourceType,
} from 'update-electron-app';

import { AppPlatform } from '../../ipc/main';
import { tm } from '../i18n';
import { log } from '../log';
import { openExternalLink } from '../security';
import { getEndpoints, testFlags } from '../test-mode';
import { pickUpdate, type AvailableUpdate, type GitHubRelease } from './releases';

const UPDATE_REPO = 'electron/fiddle';
const UPDATE_SERVICE = 'https://update.electronjs.org';
const LATEST_RELEASE_PAGE = 'https://github.com/electron/fiddle/releases/latest';

const FIRST_CHECK_MS = 10_000;
const RELEASE_CHECK_MS = 24 * 60 * 60 * 1000;

let available: AvailableUpdate | undefined;

export function startUpdates(): void {
  if (!app.isPackaged || !testFlags().updates) {
    log.info('updates are off (dev or test mode)');
    return;
  }
  if (process.platform === 'linux' || process.windowsStore) {
    setTimeout(() => {
      void checkReleases();
      setInterval(() => void checkReleases(), RELEASE_CHECK_MS);
    }, FIRST_CHECK_MS);
  } else {
    setTimeout(startAutoUpdates, FIRST_CHECK_MS);
  }
}

function startAutoUpdates(): void {
  const tp = tm('mainPlatform');
  updateElectronApp({
    updateSource: {
      type: UpdateSourceType.ElectronPublicUpdateService,
      repo: UPDATE_REPO,
      host: UPDATE_SERVICE,
    },
    updateInterval: '1 hour',
    logger: {
      log: (message) => log.info(message),
      info: (message) => log.info(message),
      warn: (message) => log.warn(message),
      error: (message) => log.error(message),
    },
    notifyUser: true,
    onNotifyUser: makeUserNotifier({
      title: tp('updateReadyTitle'),
      detail: tp('updateReadyDetail'),
      restartButtonText: tp('restart'),
      laterButtonText: tp('later'),
    }),
  });
}

/** Linux and MSIX: tells every window about a newer GitHub release. */
async function checkReleases(): Promise<void> {
  try {
    const response = await net.fetch(
      `${getEndpoints().githubApi}/repos/${UPDATE_REPO}/releases?per_page=20`,
      {
        headers: { accept: 'application/vnd.github+json' },
      },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const releases: unknown = await response.json();
    const update = Array.isArray(releases)
      ? pickUpdate(releases as GitHubRelease[], app.getVersion())
      : undefined;
    if (!update || update.version === available?.version) return;
    available = update;
    log.info('update available', update.version);
    for (const win of BrowserWindow.getAllWindows()) {
      AppPlatform.getDispatcher(win.webContents)?.dispatchUpdateAvailable(update.version);
    }
  } catch (error) {
    log.warn('release check failed', error);
  }
}

/** The toast's action: the new release's page, after the usual link confirmation. */
export async function openUpdatePage(): Promise<void> {
  await openExternalLink(available?.url ?? LATEST_RELEASE_PAGE);
}
