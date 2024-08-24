import * as path from 'node:path';

import * as namor from 'namor';

/**
 * Returns a name for this project
 */
export function getProjectName(localPath?: string): string {
  if (localPath) {
    return path.basename(localPath);
  }

  return namor.generate({ words: 3, numbers: 0 });
}
