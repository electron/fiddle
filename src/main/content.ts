import * as path from 'node:path';

import { IpcMainEvent, app } from 'electron';
import * as fs from 'fs-extra';

import { STATIC_DIR } from './constants';
import { ipcMainManager } from './ipc';
import { readFiddle } from './utils/read-fiddle';
import { isReleasedMajor } from './versions';
import { EditorValues } from '../interfaces';
import { IpcEvents } from '../ipc-events';

// parent directory of all the downloaded template fiddles
const TEMPLATES_DIR = path.join(app.getPath('userData'), 'Templates');

// location of the fallback template fiddle used iff downloading failed
const STATIC_TEMPLATE_DIR = path.join(STATIC_DIR, 'electron-quick-start');

// electron-quick-start branch that holds the test template
const TEST_TEMPLATE_BRANCH = 'test-template';

/**
 * Ensure we have a fiddle for the specified Electron branch.
 * If we don't have it already, download it from electron-quick-start.
 *
 * @param branch - Electron branchname, e.g. `12-x-y` or `main`
 * @returns Path to the folder where the fiddle is kept
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
 * @param branch - Electron branchname, e.g. `12-x-y` or `main`
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
 */
export function getTestTemplate(): Promise<EditorValues> {
  return getQuickStart(TEST_TEMPLATE_BRANCH);
}

/**
 * Get a cached copy of the fiddle for the specified Electron version.
 *
 * @param version - Electron version, e.g. 12.0.0
 */
export function getTemplate(version: string): Promise<EditorValues> {
  const major = Number.parseInt(version);
  return major && isReleasedMajor(major)
    ? getQuickStart(`${major}-x-y`)
    : readFiddle(STATIC_TEMPLATE_DIR);
}

export async function setupContent() {
  ipcMainManager.handle(
    IpcEvents.GET_TEMPLATE,
    (_: IpcMainEvent, version: string) => getTemplate(version),
  );
  ipcMainManager.handle(IpcEvents.GET_TEST_TEMPLATE, (_: IpcMainEvent) =>
    getTestTemplate(),
  );
}
