/**
 * macOS first run: offers to move the app to /Applications. Only on the first
 * launch (no `importedFrom` yet), only for a packaged app outside
 * /Applications, and never in test mode.
 */
import { app, dialog } from 'electron';

import { tm } from '../i18n';
import { log } from '../log';
import { testFlags } from '../test-mode';

export async function offerMoveToApplications(firstLaunch: boolean): Promise<void> {
  if (process.platform !== 'darwin' || !firstLaunch) return;
  if (!app.isPackaged || !testFlags().firstRunPrompts || app.isInApplicationsFolder())
    return;
  const tp = tm('mainPlatform');
  const { response } = await dialog.showMessageBox({
    type: 'question',
    message: tp('moveMessage'),
    detail: tp('moveDetail'),
    buttons: [tp('moveButton'), tp('dontMove')],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });
  if (response !== 0) return;
  try {
    // Quits and relaunches from /Applications when it succeeds.
    app.moveToApplicationsFolder();
  } catch (error) {
    log.error('moving the app to /Applications failed', error);
  }
}
