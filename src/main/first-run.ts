import { app, dialog } from 'electron';

import { isFirstRun } from '../utils/check-first-run';
import { isDevMode } from '../utils/devmode';

/**
 * Is this the first run of Fiddle? If so, perform
 * tasks that we only want to do in this case.
 */
export async function onFirstRunMaybe() {
  if (isFirstRun()) {
    await promptMoveToApplicationsFolder();
  }
}

/**
 * Ask the user if the app should be moved to the
 * applications folder.
 */
async function promptMoveToApplicationsFolder(): Promise<void> {
  if (process.platform !== 'darwin') return;
  if (isDevMode() || app.isInApplicationsFolder()) return;

  const { response } = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Move to Applications Folder', 'Do Not Move'],
    defaultId: 0,
    message: 'Move to Applications Folder?',
  });

  if (response === 0) {
    app.moveToApplicationsFolder();
  }
}
