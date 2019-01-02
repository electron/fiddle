import { app } from 'electron';
import * as fs from 'fs-extra';
import * as path from 'path';

const getConfigPath = () => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'FirstRun', 'electron-app-first-run');
};

/**
 * Whether or not the app is being run for
 * the first time
 *
 * @returns {boolean}
 */
export function isFirstRun(): boolean {
  const configPath = getConfigPath();

  try {
    if (fs.existsSync(configPath)) {
      return false;
    }

    fs.outputFileSync(configPath, '');
  } catch (error) {
    console.warn(`First run: Unable to write firstRun file`, error);
  }

  return true;
}
