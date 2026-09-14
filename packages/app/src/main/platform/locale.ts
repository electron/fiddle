/**
 * Chromium's UI language follows the language setting (REQUIREMENTS §9).
 * `--lang` must be set before `ready`, before any store exists, so the
 * setting is read straight from settings.json. A change applies after a
 * relaunch, which Settings offers.
 */
import fs from 'node:fs';
import path from 'node:path';

import { app } from 'electron';

import { pickLocale } from '../../i18n';
import { isTestMode } from '../test-mode';

/** The `locale` setting in settings.json's text, or undefined for the system default or an unreadable file. */
export function localeSettingFrom(text: string | undefined): string | undefined {
  if (!text) return undefined;
  try {
    const { locale } = JSON.parse(text) as { locale?: unknown };
    return typeof locale === 'string' && locale !== 'system' ? locale : undefined;
  } catch {
    return undefined;
  }
}

/** Before `ready`: `--lang` for a chosen language (or `FIDDLE_LOCALE` in dev and test runs). */
export function applyChromiumLanguage(): void {
  const forced = process.env.FIDDLE_LOCALE && (!app.isPackaged || isTestMode()) ? process.env.FIDDLE_LOCALE : undefined;
  let text: string | undefined;
  try {
    text = fs.readFileSync(path.join(app.getPath('userData'), 'settings.json'), 'utf8');
  } catch {
    // No settings yet: Chromium follows the OS.
  }
  const setting = forced ?? localeSettingFrom(text);
  if (setting) app.commandLine.appendSwitch('lang', pickLocale([setting]));
}

/** Restarts the app, after the usual quit (unsaved-change prompts included). */
export function relaunchApp(): void {
  app.relaunch();
  app.quit();
}
