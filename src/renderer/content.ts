import * as path from 'path';

import * as fs from 'fs-extra';

import { EditorValues } from '../interfaces';
import { readFiddle } from '../utils/read-fiddle';
import { USER_DATA_PATH } from './constants';
import { isReleasedMajor } from './versions';

const STATIC_DIR =
  process.env.NODE_ENV === 'production'
    ? path.join(__dirname, '../../static')
    : path.join(process.cwd(), './static');

// parent directory of all the downloaded template fiddles
const TEMPLATES_DIR = path.join(USER_DATA_PATH, 'Templates');

// location of the fallback template fiddle used iff downloading failed
const STATIC_TEMPLATE_DIR = path.join(STATIC_DIR, 'electron-quick-start');

// electron-quick-start branch that holds the test template
const TEST_TEMPLATE_BRANCH = 'test-template';

/**
 * Ensure we have a fiddle for the specified Electron branch.
 * If we don't have it already, download it from electron-quick-start.
 *
 * @param {string} branch - Electron branchname, e.g. `12-x-y` or `main`
 * @returns {Promise<string>} Path to the folder where the fiddle is kept
 */
async function prepareTemplate(branch: string): Promise<string> {
  let folder = path.join(TEMPLATES_DIR, `electron-quick-start-${branch}`);

  try {
    // if we don't have it, download it
    if (!fs.existsSync(folder)) {
      console.log(`Content: ${branch} downloading template`);
      const url = `https://github.com/electron/electron-quick-start/archive/${branch}.zip`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`${url} ${response.status} ${response.statusText}`);
      }

      // save it to a tempfile
      const buffer = Buffer.from(await response.arrayBuffer());
      const { tmpNameSync } = await import('tmp');
      const tempfile = tmpNameSync({ template: 'electron-fiddle-XXXXXX.zip' });
      console.log(`Content: ${branch} saving template to "${tempfile}"`);
      await fs.writeFile(tempfile, buffer, { encoding: 'utf8' });

      // unzip it from the tempfile
      console.log(`Content: ${branch} unzipping template`);
      await fs.ensureDir(TEMPLATES_DIR);
      const { default: extract } = await import('extract-zip');
      await extract(tempfile, { dir: TEMPLATES_DIR });

      // cleanup
      console.log(`Content: ${branch} unzipped; removing "${tempfile}"`);
      await fs.remove(tempfile);
    }
  } catch (err) {
    folder = STATIC_TEMPLATE_DIR;
    console.log(`Content: ${branch} failed; using ${folder}`, err);
  }

  return folder;
}

const templateCache: Record<string, Promise<EditorValues>> = {};

/**
 * Get a cached copy of the Electron branch's fiddle.
 *
 * @param {string} branch - Electron branchname, e.g. `12-x-y` or `main`
 * @returns {Promise<EditorValues>}
 */
function getQuickStart(branch: string): Promise<EditorValues> {
  // Load the template for that branch.
  // Cache the work in a Promise to prevent parallel downloads.
  let pending = templateCache[branch];
  if (!pending) {
    console.log(`Content: ${branch} template loading`);
    pending = prepareTemplate(branch).then(readFiddle);
    templateCache[branch] = pending;
  }
  return pending;
}

/**
 * Get a cached copy of the Electron Test fiddle.
 *
 * @returns {Promise<EditorValues>}
 */
export function getTestTemplate(): Promise<EditorValues> {
  return getQuickStart(TEST_TEMPLATE_BRANCH);
}

/**
 * Get a cached copy of the fiddle for the specified Electron version.
 *
 * @param {string} version - Electron version, e.g. 12.0.0
 * @returns {Promise<EditorValues>}
 */
export function getTemplate(version: string): Promise<EditorValues> {
  const major = Number.parseInt(version);
  return major && isReleasedMajor(major)
    ? getQuickStart(`${major}-x-y`)
    : readFiddle(STATIC_TEMPLATE_DIR);
}
