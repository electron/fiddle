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
  if (fs.existsSync(configPath)) return false;

  try {
    fs.writeFileSync(configPath, '');
  } catch (err) {
    if (err.code === 'ENOENT') {
      fs.mkdirpSync(path.join(app.getPath('userData'), 'FirstRun'));
      return isFirstRun();
    }
    throw err;
  }
  return true;
}
