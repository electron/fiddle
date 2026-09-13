/**
 * App platform behavior (REQUIREMENTS §13, §14, §17.16), started from
 * main/index.ts after the services and menu, before windows: the About
 * panel, protocol registration, the macOS move to /Applications, updates,
 * and the background copy of old Electron versions. The Help commands are in
 * ../app-commands.ts.
 *
 * Squirrel events (./squirrel.ts) and Sentry (../crash/sentry.ts) start
 * earlier, before `ready`. "Closing the last window quits, except on macOS"
 * is ./lifecycle.ts.
 */
import { applyCrashReportsSetting, markCrashUiReady } from '../crash/sentry';
import { importElectronVersionsInBackground } from '../migration';
import type { StateHub } from '../state-hub';
import { startUpdates } from '../updates';
import { setupAboutPanel } from './about';
import { offerMoveToApplications } from './first-run';
import { finishStartup } from './lifecycle';
import { registerProtocolClient } from './protocol-client';

export { installQuitOnLastWindowClosed } from './lifecycle';

/** `firstLaunch`: from the one-time import, no earlier launch of this app. */
export async function startPlatform(hub: StateHub, firstLaunch: boolean): Promise<void> {
  finishStartup();
  markCrashUiReady();
  setupAboutPanel();
  registerProtocolClient();
  hub.onChange(() => applyCrashReportsSetting(hub.app.settings.crashReports));
  await offerMoveToApplications(firstLaunch);
  startUpdates({ beta: hub.app.settings.betaUpdates });
  if (firstLaunch) importElectronVersionsInBackground();
}
