/**
 * Sentry in the main process (REQUIREMENTS §14): org `electronjs`, project
 * `electron-fiddle`.
 *
 * - Off in dev (unpackaged), in test mode, in headless mode, and when the
 *   "Send crash reports" setting is off. The setting is read from
 *   settings.json before `Sentry.init`, which runs before `ready`. Turning it
 *   off closes Sentry at once; turning it on applies at the next launch.
 * - An explicit integration allowlist: no console, network or local-variable
 *   integrations. `sendDefaultPii` is off.
 * - `IPCMode.Classic`: renderers reach Sentry through the app's own preload
 *   (src/preload/index.ts), the one documented exception to EIPC (§3).
 * - `beforeSend` / `beforeBreadcrumb` scrub everything (./scrub.ts). Native
 *   dumps from main are never sent; renderer dumps only after the user agrees,
 *   crash by crash.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import * as Sentry from '@sentry/electron/main';
import { app, dialog } from 'electron';

import { defaultSettings, parseSetting } from '../../shared/settings';
import { tm } from '../i18n';
import { log } from '../log';
import { testFlags } from '../test-mode';
import { prepareEvent, scrubBreadcrumb } from './scrub';

export const SENTRY_DSN = 'https://966a5b01ac8d4941b81e4ebd0ab4c991@sentry.io/1882540';

let enabled = false;

/** Whether Sentry is running in main. The renderer starts its SDK only then. */
export function isCrashReportingEnabled(): boolean {
  return enabled;
}

/**
 * The Sentry release, `Electron-Fiddle@<package.json version>` with no `v`:
 * `@sentry/electron`'s default format, which the release workflow uses too
 * (PROGRESS.md, "Sentry release name").
 */
function releaseName(appName: string, version: string): string {
  return `${appName.replace(/\W/g, '-')}@${version.replace(/^v/, '')}`;
}

/** Headless CLI mode (REQUIREMENTS §7) never sends crash reports. */
function isHeadless(argv: readonly string[] = process.argv): boolean {
  return argv.includes('--headless');
}

/** Reads `crashReports` straight from settings.json: Sentry starts before the settings store. */
function readCrashReportsSetting(userData: string): boolean {
  try {
    const data: unknown = JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf8'));
    const value = (data as { crashReports?: unknown } | null)?.crashReports;
    return parseSetting('crashReports', value)?.value ?? defaultSettings.crashReports;
  } catch {
    return defaultSettings.crashReports;
  }
}

let resolveUiReady: () => void = () => undefined;
const uiReady = new Promise<void>((resolve) => {
  resolveUiReady = resolve;
});

/** Main's i18n is ready, so crash-report prompts can be shown. */
export function markCrashUiReady(): void {
  resolveUiReady();
}

let consentQueue: Promise<unknown> = Promise.resolve();

/** Asks whether to send one renderer crash report. Prompts are shown one at a time. */
function askToSendRendererCrash(): Promise<boolean> {
  const answer = consentQueue.then(async () => {
    await app.whenReady();
    await uiReady;
    const tp = tm('mainPlatform');
    const { response } = await dialog.showMessageBox({
      type: 'warning',
      message: tp('crashConsentMessage'),
      detail: tp('crashConsentDetail'),
      buttons: [tp('sendReport'), tp('dontSend')],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
    });
    return response === 0;
  });
  consentQueue = answer.catch(() => undefined);
  return answer.catch((error: unknown) => {
    log.error('crash report prompt failed', error);
    return false;
  });
}

/** Starts Sentry in main if it's allowed. Call before `ready`, after Squirrel handling. */
export function initCrashReporting(): void {
  const off = !app.isPackaged
    ? 'dev'
    : !testFlags().sentry
      ? 'test mode'
      : isHeadless()
        ? 'headless'
        : !readCrashReportsSetting(app.getPath('userData'))
          ? 'setting'
          : undefined;
  if (off) {
    log.info(`crash reporting is off (${off})`);
    return;
  }
  const home = os.homedir();
  Sentry.init({
    dsn: SENTRY_DSN,
    release: releaseName(app.getName(), app.getVersion()),
    ipcMode: Sentry.IPCMode.Classic,
    sendDefaultPii: false,
    defaultIntegrations: false,
    integrations: [
      // Native crashes. What is sent is decided in prepareEvent.
      Sentry.sentryMinidumpIntegration(),
      Sentry.electronBreadcrumbsIntegration(),
      Sentry.electronContextIntegration(),
      Sentry.additionalContextIntegration(),
      Sentry.childProcessIntegration(),
      Sentry.onUncaughtExceptionIntegration(),
      Sentry.onUnhandledRejectionIntegration(),
      // Release health: crash-free sessions gate stable releases (§13).
      Sentry.mainProcessSessionIntegration(),
      Sentry.eventFiltersIntegration(),
      Sentry.functionToStringIntegration(),
      Sentry.linkedErrorsIntegration(),
      Sentry.dedupeIntegration(),
      Sentry.nodeContextIntegration({ cloudResource: false }),
      Sentry.normalizePathsIntegration(),
    ],
    beforeSend: (event) => prepareEvent(event, home, askToSendRendererCrash),
    beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb, home),
  });
  enabled = true;
  log.info('crash reporting is on');
}

/** Follows the setting at runtime: off closes Sentry now; on needs a restart. */
export function applyCrashReportsSetting(on: boolean): void {
  if (on || !enabled) return;
  enabled = false;
  void Sentry.close().catch((error: unknown) => log.warn('closing Sentry failed', error));
  log.info('crash reporting turned off');
}
