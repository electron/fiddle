import path from 'node:path';

import { app } from 'electron';

import { pickLocale } from '../../i18n';
import { parseSetting } from '../../shared/settings';
import { readJsonObjectSync } from '../persistence/json-store';
import { isTestMode } from '../test-mode';

/** The chosen language in the settings object, or undefined for the system default or an invalid value. */
export function localeSettingFrom(
  data: Record<string, unknown> | undefined,
): string | undefined {
  const locale = parseSetting('locale', data?.locale)?.value;
  return locale === undefined || locale === 'system' ? undefined : locale;
}

/** Before `ready`: `--lang` for a chosen language (or `FIDDLE_LOCALE` in dev and test runs). No store exists yet, so settings.json is read directly. */
export function applyChromiumLanguage(): void {
  const forced =
    process.env.FIDDLE_LOCALE && (!app.isPackaged || isTestMode())
      ? process.env.FIDDLE_LOCALE
      : undefined;
  const data = readJsonObjectSync(path.join(app.getPath('userData'), 'settings.json'));
  const setting = forced ?? localeSettingFrom(data);
  if (setting) app.commandLine.appendSwitch('lang', pickLocale([setting]));
}

let relaunchRequested = false;

/**
 * Restarts the app after the usual quit (unsaved-change prompts included). The
 * relaunch is armed only once the app has really quit: `app.relaunch()` can't
 * be undone, and the quit can be cancelled.
 */
export function relaunchApp(): void {
  relaunchRequested = true;
  app.quit();
}

/** The user cancelled the quit that `relaunchApp` started. */
export function cancelRelaunch(): void {
  relaunchRequested = false;
}

export function installRelaunchOnQuit(): void {
  app.on('quit', () => {
    if (relaunchRequested) app.relaunch();
  });
}
