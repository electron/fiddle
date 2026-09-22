import os from 'node:os';
import path from 'node:path';

import * as Sentry from '@sentry/electron/main';
import { app } from 'electron';

import { defaultSettings, parseSetting } from '../../shared/settings';
import { log } from '../log';
import { readJsonObjectSync } from '../persistence/json-store';
import { isTestMode } from '../test-mode';
import { prepareEvent, scrubBreadcrumb } from './scrub';

export const SENTRY_DSN = 'https://966a5b01ac8d4941b81e4ebd0ab4c991@sentry.io/1882540';

let enabled = false;

/**
 * The Sentry release, `Electron-Fiddle@<package.json version>` with no `v`:
 * `@sentry/electron`'s default format, which the release workflow uses too.
 */
function releaseName(appName: string, version: string): string {
  return `${appName.replace(/\W/g, '-')}@${version.replace(/^v/, '')}`;
}

/** Sentry starts before the settings store, so this reads settings.json (or its `.bak`, as the store would) itself. */
function readCrashReportsSetting(userData: string): boolean {
  const data = readJsonObjectSync(path.join(userData, 'settings.json'));
  return (
    parseSetting('crashReports', data?.crashReports)?.value ??
    defaultSettings.crashReports
  );
}

/** Starts Sentry in main if it's allowed, and returns whether it did. Call before `ready`, after Squirrel handling. Headless CLI runs never send reports. */
export function initCrashReporting(headless = false): boolean {
  const off = !app.isPackaged
    ? 'dev'
    : isTestMode()
      ? 'test mode'
      : headless
        ? 'headless'
        : !readCrashReportsSetting(app.getPath('userData'))
          ? 'setting'
          : undefined;
  if (off) {
    log.info(`crash reporting is off (${off})`);
    return false;
  }
  const home = os.homedir();
  Sentry.init({
    dsn: SENTRY_DSN,
    release: releaseName(app.getName(), app.getVersion()),
    // Renderers reach Sentry through the app's own preload: the one exception to EIPC-only IPC.
    ipcMode: Sentry.IPCMode.Classic,
    sendDefaultPii: false,
    // An explicit allowlist: no console, network or local-variable integrations, so those never collect anything.
    defaultIntegrations: false,
    integrations: [
      // Native crashes: the dumps are dropped in prepareEvent.
      Sentry.sentryMinidumpIntegration(),
      Sentry.electronBreadcrumbsIntegration(),
      Sentry.electronContextIntegration(),
      Sentry.additionalContextIntegration(),
      Sentry.childProcessIntegration(),
      Sentry.onUncaughtExceptionIntegration(),
      Sentry.onUnhandledRejectionIntegration(),
      // Release health: crash-free sessions gate stable releases.
      Sentry.mainProcessSessionIntegration(),
      Sentry.eventFiltersIntegration(),
      Sentry.functionToStringIntegration(),
      Sentry.linkedErrorsIntegration(),
      Sentry.dedupeIntegration(),
      Sentry.nodeContextIntegration({ cloudResource: false }),
      Sentry.normalizePathsIntegration(),
    ],
    beforeSend: (event) => prepareEvent(event, home),
    beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb, home),
  });
  log.info('crash reporting is on');
  return (enabled = true);
}

/** Follows the setting at runtime: off closes Sentry now; on needs a restart. Returns whether Sentry still runs. */
export function applyCrashReportsSetting(on: boolean): boolean {
  if (!on && enabled) {
    enabled = false;
    void Sentry.close().catch((error: unknown) =>
      log.warn('closing Sentry failed', error),
    );
    log.info('crash reporting turned off');
  }
  return enabled;
}
