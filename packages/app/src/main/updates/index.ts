/**
 * Updates and rollout. Off in dev (unpackaged) and test mode.
 *
 * - macOS and Windows (Squirrel): `update-electron-app` against
 *   update.electronjs.org for electron/fiddle, every hour, first 10 s after
 *   launch. The "Beta updates" setting switches to a StaticStorage feed once
 *   one exists. The setting applies at the next launch.
 * - Linux and MSIX: no auto-update. The GitHub releases API is checked once a
 *   day, and an "Update available" toast goes to the windows through the
 *   `AppPlatform.UpdateAvailable` event.
 * - Kill switch: `update-policy.json` is fetched at startup. A blocked version
 *   gets a blocking notice, then quits. If the fetch fails, the app keeps running.
 */
import { app, BrowserWindow, dialog, net, shell } from 'electron';
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
import {
  evaluatePolicy,
  parsePolicy,
  pickUpdate,
  type AvailableUpdate,
  type GitHubRelease,
} from './policy';

const UPDATE_REPO = 'electron/fiddle';
const UPDATE_SERVICE = 'https://update.electronjs.org';
/**
 * The "Beta updates" feed: a StaticStorage feed for `update-electron-app`, with
 * one `<platform>/<arch>/` folder per build below this URL. No such feed exists
 * yet, so until this is set, Beta updates keep checking the stable source
 * instead of failing every hour.
 */
const BETA_UPDATE_FEED_URL: string | undefined = undefined;
/** The kill switch, kept in the electron/fiddle repository. */
const UPDATE_POLICY_URL =
  'https://raw.githubusercontent.com/electron/fiddle/main/update-policy.json';
const LATEST_RELEASE_PAGE = 'https://github.com/electron/fiddle/releases/latest';

const FIRST_CHECK_MS = 10_000;
const RELEASE_CHECK_MS = 24 * 60 * 60 * 1000;
const POLICY_TIMEOUT_MS = 10_000;

let available: AvailableUpdate | undefined;

export function startUpdates({ beta }: { beta: boolean }): void {
  if (!app.isPackaged || !testFlags().updates) {
    log.info('updates are off (dev or test mode)');
    return;
  }
  void checkUpdatePolicy();
  if (process.platform === 'linux' || process.windowsStore) {
    setTimeout(() => {
      void checkReleases(beta);
      setInterval(() => void checkReleases(beta), RELEASE_CHECK_MS);
    }, FIRST_CHECK_MS);
  } else {
    setTimeout(() => startAutoUpdates(beta), FIRST_CHECK_MS);
  }
}

function startAutoUpdates(beta: boolean): void {
  const tp = tm('mainPlatform');
  updateElectronApp({
    updateSource:
      beta && BETA_UPDATE_FEED_URL
        ? {
            type: UpdateSourceType.StaticStorage,
            baseUrl: `${BETA_UPDATE_FEED_URL}/${process.platform}/${process.arch}`,
          }
        : {
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
async function checkReleases(beta: boolean): Promise<void> {
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
      ? pickUpdate(releases as GitHubRelease[], app.getVersion(), beta)
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

async function checkUpdatePolicy(): Promise<void> {
  let data: unknown;
  try {
    const response = await net.fetch(UPDATE_POLICY_URL, {
      signal: AbortSignal.timeout(POLICY_TIMEOUT_MS),
    });
    if (!response.ok) {
      log.info('no update policy', response.status);
      return;
    }
    data = await response.json();
  } catch (error) {
    log.warn('update policy check failed; carrying on', error);
    return;
  }
  const policy = parsePolicy(data);
  if (!policy) {
    log.warn('update policy is invalid; ignoring it');
    return;
  }
  const verdict = evaluatePolicy(policy, app.getVersion());
  if (verdict.blocked) await showBlockedNotice(verdict.message);
}

async function showBlockedNotice(message: string | undefined): Promise<void> {
  log.error('this version is blocked by the update policy', app.getVersion());
  const tp = tm('mainPlatform');
  const { response } = await dialog.showMessageBox({
    type: 'error',
    message: tp('versionBlockedMessage'),
    detail: message || tp('versionBlockedDetail'),
    buttons: [tp('downloadLatest'), tp('quit')],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });
  if (response === 0) await shell.openExternal(LATEST_RELEASE_PAGE);
  app.quit();
}
