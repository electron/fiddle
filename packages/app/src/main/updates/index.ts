import { app, autoUpdater, dialog, net } from 'electron';
import { updateElectronApp, UpdateSourceType } from 'update-electron-app';

import { confirmQuit } from '../documents/service';
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
const RELEASE_CHECK_TIMEOUT_MS = 30_000;

let available: AvailableUpdate | undefined;

/** Off in dev and test mode. Linux and MSIX have no auto-update: `onAvailable` gets a newer release's version, which each window shows as a toast. */
export function startUpdates(onAvailable: (version: string) => void): void {
  if (!app.isPackaged || !testFlags().updates) {
    log.info('updates are off (dev or test mode)');
    return;
  }
  if (process.platform === 'linux' || process.windowsStore) {
    setTimeout(() => {
      void checkReleases(onAvailable);
      setInterval(() => void checkReleases(onAvailable), RELEASE_CHECK_MS);
    }, FIRST_CHECK_MS);
  } else {
    setTimeout(startAutoUpdates, FIRST_CHECK_MS);
  }
}

function startAutoUpdates(): void {
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
    onNotifyUser: () => void promptRestart(),
  });
}

/**
 * `quitAndInstall()` closes every window before `before-quit`, so the
 * unsaved-changes check of a normal quit runs first.
 */
async function promptRestart(): Promise<void> {
  const tp = tm('mainPlatform');
  const { response } = await dialog.showMessageBox({
    type: 'info',
    message: tp('updateReadyTitle'),
    detail: tp('updateReadyDetail'),
    buttons: [tp('restart'), tp('later')],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });
  if (response === 0 && (await confirmQuit())) autoUpdater.quitAndInstall();
}

/** Linux and MSIX: looks for a newer GitHub release. */
async function checkReleases(onAvailable: (version: string) => void): Promise<void> {
  try {
    const response = await net.fetch(
      `${getEndpoints().githubApi}/repos/${UPDATE_REPO}/releases?per_page=20`,
      {
        headers: { accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(RELEASE_CHECK_TIMEOUT_MS),
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
    onAvailable(update.version);
  } catch (error) {
    log.warn('release check failed', error);
  }
}

/** The toast's action: the new release's page, after the usual link confirmation. */
export async function openUpdatePage(): Promise<void> {
  await openExternalLink(available?.url ?? LATEST_RELEASE_PAGE);
}
