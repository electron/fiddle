import { applyCrashReportsSetting } from '../crash/sentry';
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
  setupAboutPanel();
  registerProtocolClient();
  hub.onChange(() => {
    const crashReporting = applyCrashReportsSetting(hub.app.settings.crashReports);
    if (crashReporting !== hub.app.crashReporting) hub.updateApp({ crashReporting });
  });
  await offerMoveToApplications(firstLaunch);
  startUpdates((version) => hub.updateApp({ updateAvailable: version }));
  importElectronVersionsInBackground();
}
