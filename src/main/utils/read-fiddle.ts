import * as path from 'node:path';

import * as fs from 'fs-extra';

import { EditorId, EditorValues, PACKAGE_NAME } from '../../interfaces';
import { ensureRequiredFiles, isSupportedFile } from '../../utils/editor-utils';

/**
 * Reads a Fiddle from a directory.
 *
 * @returns the loaded Fiddle
 */
export async function readFiddle(
  folder: string,
  includePackageJson = false,
): Promise<EditorValues> {
  let got: EditorValues = {};

  try {
    // TODO(dsanders11): Remove options once issue fixed:
    // https://github.com/isaacs/node-graceful-fs/issues/223
    const files = await fs.readdir(folder, { encoding: 'utf8' });
    const names = files.filter((f) => {
      if (f === 'package-lock.json') {
        return false;
      }

      if (f === PACKAGE_NAME) {
        return includePackageJson;
      }

      return isSupportedFile(f);
    });

    const values = await Promise.allSettled(
      names.map((name) => fs.readFile(path.join(folder, name), 'utf8')),
    );

    for (let i = 0; i < names.length; ++i) {
      const name = names[i] as EditorId;
      const value = values[i];

      if (value.status === 'fulfilled') {
        got[name] = value.value || '';
      } else {
        console.warn(`Could not read file ${name}:`, value.reason);
        got[name] = '';
      }
    }
  } catch (err) {
    console.warn(`Unable to read "${folder}": ${err.toString()}`);
  }

  got = ensureRequiredFiles(got);
  console.log(`Got Fiddle from "${folder}". Found:`, Object.keys(got).sort());
  return got;
}
