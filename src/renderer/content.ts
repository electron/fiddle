import { USER_DATA_PATH } from './constants';
import { EditorId } from '../interfaces';
import {
  INDEX_HTML_NAME,
  MAIN_JS_NAME,
  PRELOAD_JS_NAME,
  RENDERER_JS_NAME,
  STYLES_CSS_NAME,
} from '../shared-constants';
import { fancyImport } from '../utils/import';

import * as fsType from 'fs-extra';
import * as extractZipType from 'extract-zip';
import * as fetchType from 'node-fetch';
import * as path from 'path';
import * as semver from 'semver';
import fetch from 'node-fetch';

const TEMPLATES_DIR = path.join(USER_DATA_PATH, 'Templates');

const STATIC_TEMPLATE_DIR = path.resolve(__dirname, '../../static/electron-quick-start');

function getTemplateBranch(
  version?: string
): string {
  const parsed = semver.parse(version);
  return parsed && parsed.major ? `${parsed.major}-x-y` : 'master';
}

// Get the URL of the zipfile for a given electron-quick-start branch
function getTemplateURL(
  branch: string
): string {
  return `https://github.com/electron/electron-quick-start/archive/${branch}.zip`;
}

async function setupTemplateImpl(
  version?: string
): Promise<string> {
  const branchName = getTemplateBranch(version);
  const templatePath = path.join(TEMPLATES_DIR, `electron-quick-start-${branchName}`);

  // if we already have it, don't download it
  const fs = await fancyImport<typeof fsType>('fs-extra')
  if (fs.existsSync(path.join(templatePath, MAIN_JS_NAME))) {
    console.log(`Loading template for Electron ${branchName} from ${templatePath}`);
    return templatePath;
  }

  try {
    // download it
    console.log(`Downloading template for Electron ${branchName}`);
    const response : fetchType.Response = await fetch(getTemplateURL(branchName));
    const buf : Buffer = await response.buffer();
    const tmpfile = `${templatePath}.zip`;

    // save the zip as a tmpfile
    await fs.outputFile(tmpfile, buf);

    // unzip it
    const extract: typeof extractZipType = (await fancyImport<any>('extract-zip')) .default;
    await extract(tmpfile, { dir: TEMPLATES_DIR });

    // remove the tmpfile
    await fs.unlink(tmpfile);

    return templatePath;
  } catch (err) {
    console.log(`Unable to download template; using ${STATIC_TEMPLATE_DIR}: ${err}`);
    return STATIC_TEMPLATE_DIR;
  }
}

const setupPending = {};

async function setupTemplate(
  version?: string
): Promise<string> {
  const branchName = getTemplateBranch(version);
  let promise = setupPending[branchName];
  if (!promise) {
    promise = setupTemplateImpl(version);
  }
  setupPending[branchName] = promise;
  return promise;
}

function getFilenameForEditorId(
  name: EditorId
): string {
  switch (name) {
    case EditorId.main: return MAIN_JS_NAME;
    case EditorId.renderer: return RENDERER_JS_NAME;
    case EditorId.html: return INDEX_HTML_NAME;
    case EditorId.preload: return PRELOAD_JS_NAME;
    case EditorId.css: return STYLES_CSS_NAME;
    default: throw new Error(`Unknown EditorId: ${name}`);
  }
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
  const templatePath = await setupTemplate(version);
  const filename = getFilenameForEditorId(name);
  const fs = await fancyImport<typeof fsType>('fs-extra')
  try {
    return await fs.readFile(path.join(templatePath, filename), { encoding: 'utf8' });
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
