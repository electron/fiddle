import * as fs from 'fs';

import { Installer } from '@electron/fiddle-core';

/**
 * Verifies if the local electron path is valid
 */
export function isValidElectronPath(folderPath: string): boolean {
  const execPath = Installer.getExecPath(folderPath);
  return fs.existsSync(execPath);
}
