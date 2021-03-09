import { USER_DATA_PATH } from './constants';
import { EditorId, EditorValues } from '../interfaces';
import { fancyImport } from '../utils/import';
import { readFiddle } from '../utils/read-fiddle';

import * as extractZipType from 'extract-zip';
import * as fsType from 'fs-extra';
import * as path from 'path';
import * as fetchType from 'node-fetch';
import * as semver from 'semver';

const TEMPLATES_DIR = path.join(USER_DATA_PATH, 'Templates');
const STATIC_TEMPLATE_DIR = path.resolve(__dirname, '../../static/electron-quick-start');

/**
 * Ensure the Electron branch's default fiddle exists; downloading it if necessary
 *
 * @param {branch} Electron branchname, e.g. `12-x-y` or `master`
 * @returns {folder} Location of the fiddle's files
 */
async function prepareTemplate(
  branch: string
): Promise<string> {
  let folder = path.join(TEMPLATES_DIR, `electron-quick-start-${branch}`);

  try {
    // if we don't have it, download it
    const fs = await fancyImport<typeof fsType>('fs-extra')
    if (!fs.existsSync(folder)) {
      const url = `https://github.com/electron/electron-quick-start/archive/${branch}.zip`;
      console.log(`Content: Downloading ${url}`);
      const fetch = (await fancyImport<any>('node-fetch')).default;
      const response : fetchType.Response = await fetch(url);
      const buf : Buffer = await response.buffer();
      const tmpfile = `${folder}.zip`;

      // save the zip as a tmpfile
      await fs.outputFile(tmpfile, buf);

      // unzip it
      const extract: typeof extractZipType = (await fancyImport<any>('extract-zip')) .default;
      await extract(tmpfile, { dir: TEMPLATES_DIR });

      // remove the tmpfile
      await fs.unlink(tmpfile);
    }
  } catch (err) {
    folder = STATIC_TEMPLATE_DIR;
    console.log(`Content: Unable to download fiddle; using ${folder}: ${err}`);
  }

  return folder;
}

/**
 * Read the specified branch's default fiddle from disk
 *
 * @param {branch} Electron branchname, e.g. `12-x-y` or `master`
 * @returns {Promise<EditorValues>}
 */
async function readTemplate(
  branch: string
): Promise<EditorValues> {
  const folder = await prepareTemplate(branch);
  console.log(`Content: Loading fiddle for Electron ${branch} from ${folder}`);
  return readFiddle(folder);
}

const templateCache : Record<string, Promise<EditorValues>> = {};

/**
 * Return a cached copy of the specified branch's default fiddle
 *
 * @param {string} [version]
 * @returns {Promise<EditorValues>}
 */
export async function getTemplate(
  version?: string
): Promise<EditorValues> {
  // get the branch
  const parsed = semver.parse(version);
  const branch : string = parsed && parsed.major ? `${parsed.major}-x-y` : 'master';

  // load the template for that branch
  let pending = templateCache[branch];
  if (!pending) {
    pending = templateCache[branch] = readTemplate(branch);
  }

  return pending;
}

/**
 * Returns expected content for a given name.
 *
 * @export
 * @param {EditorId} name
 * @param {string} [version]
 * @returns {Promise<string>}
 */
export async function getContent(
  name: EditorId,
  version?: string,
): Promise<string> {
  try {
    return (await getTemplate(version))[name];
  } catch (err) {
    console.log(err);
    return '';
  }
}

/**
 * Did the content change?
 *
 * @param {EditorId} name
 * @returns {Promise<boolean>}
 */
export async function isContentUnchanged(name: EditorId): Promise<boolean> {
  if (!window.ElectronFiddle || !window.ElectronFiddle.app) return false;

  const values = await window.ElectronFiddle.app.getEditorValues({
    include: false,
  });

  // Handle main case, which needs to check both possible versions
  if (name === EditorId.main) {
    const isChanged1x =
      (await getContent(EditorId.main, '1.0')) === values.main;
    const isChangedOther = (await getContent(EditorId.main)) === values.main;

    return isChanged1x || isChangedOther;
  } else {
    return values[name] === (await getContent(name));
  }
}
