/**
 * App platform behavior (REQUIREMENTS §13, §14, §17.16), started from
 * main/index.ts after `ready` and i18n, before menus and windows:
 * Help commands, the About panel, protocol registration, the macOS move to
 * /Applications, updates, and the background copy of old Electron versions.
 *
 * Squirrel events (./squirrel.ts) and Sentry (../crash/sentry.ts) start
 * earlier, before `ready`. "Closing the last window quits, except on macOS"
 * is the `window-all-closed` handler in main/index.ts.
 */
import { app, shell } from 'electron';

import type { CommandRegistry } from '../commands';
import { applyCrashReportsSetting, markCrashUiReady } from '../crash/sentry';
import { log, logsDir } from '../log';
import { importElectronVersionsInBackground } from '../migration';
import { openExternalLink } from '../security';
import type { StateHub } from '../state-hub';
import { startUpdates } from '../updates';
import { setupAboutPanel } from './about';
import { copyDiagnostics } from './diagnostics';
import { offerMoveToApplications } from './first-run';
import { finishStartup } from './lifecycle';
import { registerProtocolClient } from './protocol-client';

const LINKS = {
  'help.fiddleRepository': 'https://github.com/electron/fiddle',
  'help.electronRepository': 'https://github.com/electron/electron',
  'help.reportIssue': 'https://github.com/electron/fiddle/issues',
} as const;

export interface StartPlatformOptions {
  hub: StateHub;
  registry: CommandRegistry;
  /** From the one-time import: no earlier launch of this app. */
  firstLaunch: boolean;
}

export { installQuitOnLastWindowClosed } from './lifecycle';

export async function startPlatform({ hub, registry, firstLaunch }: StartPlatformOptions): Promise<void> {
  finishStartup();
  markCrashUiReady();
  registerPlatformCommands(registry, hub);
  setupAboutPanel();
  registerProtocolClient();
  hub.onChange(() => applyCrashReportsSetting(hub.app.settings.crashReports));
  await offerMoveToApplications(firstLaunch);
  startUpdates({ beta: hub.app.settings.betaUpdates });
  if (firstLaunch) importElectronVersionsInBackground();
}

function registerPlatformCommands(registry: CommandRegistry, hub: StateHub): void {
  registry.register('help.about', () => app.showAboutPanel());
  registry.register('help.openLogsFolder', async () => {
    const dir = logsDir();
    const error = dir ? await shell.openPath(dir) : 'no logs folder';
    if (error) log.warn('could not open the logs folder', error);
  });
  registry.register('help.copyDiagnostics', () => copyDiagnostics(hub));
  for (const [id, url] of Object.entries(LINKS) as [keyof typeof LINKS, string][]) {
    registry.register(id, () => openExternalLink(url));
  }
}
