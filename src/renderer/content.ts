import { appState } from './state';
import { USER_DATA_PATH } from './constants';
import {
  EditorId,
  EditorValues,
  RunnableVersion,
  VersionSource,
} from '../interfaces';
import { fancyImport } from '../utils/import';
import { readFiddle } from '../utils/read-fiddle';

import * as fsType from 'fs-extra';
import * as path from 'path';
import * as semver from 'semver';
import decompress from 'decompress';

// parent directory of all the downloaded template fiddles
const TEMPLATES_DIR = path.join(USER_DATA_PATH, 'Templates');

// location of the fallback template fiddle used iff downloading failed
const STATIC_TEMPLATE_DIR = path.resolve(
  __dirname,
  '../../static/electron-quick-start',
);

/**
 * Ensure we have a fiddle for the specified Electron branch.
 * If we don't have it already, download it from electron-quick-start.
 *
 * @param {string} branch Electron branchname, e.g. `12-x-y` or `master`
 * @returns {Promise<string>} Path to the folder where the fiddle is kept
 */
async function prepareTemplate(branch: string): Promise<string> {
  let folder = path.join(TEMPLATES_DIR, `electron-quick-start-${branch}`);

  try {
    // if we don't have it, download it
    const fs = await fancyImport<typeof fsType>('fs-extra');
    if (!fs.existsSync(folder)) {
      console.log(`Content: Downloading template for ${branch}`);
      const url = `https://github.com/electron/electron-quick-start/archive/${branch}.zip`;
      const response: Response = await fetch(url);
      if (!response.ok) {
        throw new Error(`${url} ${response.status} ${response.statusText}`);
      }

      console.log(`Content: Unzipping template for ${branch}`);
      const arrayBuffer = await response.arrayBuffer();
      await fs.ensureDir(TEMPLATES_DIR);
      await decompress(Buffer.from(arrayBuffer), TEMPLATES_DIR);
    }
  } catch (err) {
    folder = STATIC_TEMPLATE_DIR;
    console.log(
      `Content: Unable to get template for ${branch}; using ${folder}`,
      err,
    );
  }

  return folder;
}

const templateCache: Record<string, Promise<EditorValues>> = {};

/**
 * Helper to check if this version is from a released major branch.
 *
 * This way when we have a local version of Electron like '999.0.0'
 * we'll know to not try & download 999-x-y.zip from GitHub :D
 *
 * @param {string} [version]
 * @returns {boolean} true if major version is a known release
 */
function isReleasedMajor(version?: string) {
  const newestRelease = Object.values(appState.versions)
    .filter((version) => version.source === VersionSource.remote)
    .map((version) => semver.parse(version.version))
    .filter((version) => !!version)
    .sort((a: semver.SemVer, b: semver.SemVer) => semver.compare(a, b))
    .pop();
  const parsed = semver.parse(version);
  return parsed && newestRelease && parsed.major <= newestRelease.major;
}

/**
 * Get a cached copy of the fiddle for the specified Electron version.
 *
 * @param {string} [version]
 * @returns {Promise<EditorValues>}
 */
export async function getTemplate(version?: string): Promise<EditorValues> {
  // get the branch
  const parsed = semver.parse(version);
  const branch: string = parsed?.major ? `${parsed.major}-x-y` : 'master';

  // load the template for that branch
  let pending = templateCache[branch];
  if (!pending) {
    const folder = isReleasedMajor(version)
      ? await prepareTemplate(branch)
      : STATIC_TEMPLATE_DIR;
    console.log(`Content: Loading fiddle for Electron ${branch}`);
    pending = templateCache[branch] = readFiddle(folder);
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
  return (await getTemplate(version))[name];
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

  return values[name] === (await getContent(name));
}
