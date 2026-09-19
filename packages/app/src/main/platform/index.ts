import { applyCrashReportsSetting } from '../crash/sentry';
import { importElectronVersionsInBackground } from '../migration';
import type { StateHub } from '../state-hub';
import { startUpdates } from '../updates';
import { setupAboutPanel } from './about';
import { offerMoveToApplications } from './first-run';
import { finishStartup } from './lifecycle';
import { installRelaunchOnQuit } from './locale';
import { registerProtocolClient } from './protocol-client';

export { installQuitOnLastWindowClosed } from './lifecycle';

/** `firstLaunch`: from the one-time import, no earlier launch of this app. */
export async function startPlatform(hub: StateHub, firstLaunch: boolean): Promise<void> {
  finishStartup();
  installRelaunchOnQuit();
  setupAboutPanel();
  registerProtocolClient();
  hub.onChange(() => applyCrashReportsSetting(hub.app.settings.crashReports));
  await offerMoveToApplications(firstLaunch);
  startUpdates();
  importElectronVersionsInBackground();
}
