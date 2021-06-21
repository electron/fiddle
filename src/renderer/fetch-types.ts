import * as MonacoType from 'monaco-editor';
import * as fs from 'fs-extra';
import * as path from 'path';

import { RunnableVersion, VersionSource } from '../interfaces';
import { normalizeVersion } from '../utils/normalize-version';
import { USER_DATA_PATH } from './constants';

const definitionPath = path.join(USER_DATA_PATH, 'electron-typedef');

/**
 * Fetch TypeScript definitions for the current version of Electron (online)
 *
 * @param {string} version
 * @returns {Promise<string>}
 */
export async function fetchTypeDefinitions(version: string): Promise<string> {
  const packageName = version.includes('nightly')
    ? 'electron-nightly'
    : 'electron';
  const url = `https://unpkg.com/${packageName}@${version}/electron.d.ts`;

  let text: string;
  try {
    const response = await window.fetch(url);
    text = await response.text();
  } catch (error) {
    console.warn(`Fetch Types: Could not fetch definitions`, error);
    return '';
  }

  // for invalid packa
  if (text.includes('Cannot find package')) {
    console.warn(`Fetch Types: ${text}`);
    return '';
  } else {
    return text;
  }
}

/**
 * Removes the type definition for a given version
 *
 * @param version
 */
export function removeTypeDefsForVersion(version: string): Promise<void> {
  const _version = normalizeVersion(version);
  const typeDefsDir = path.dirname(getOfflineTypeDefinitionPath(_version));
  return fs.remove(typeDefsDir);
}

/**
 * Get the path for offline TypeScript definitions
 *
 * @param {string} version
 * @returns {string}
 */
export function getOfflineTypeDefinitionPath(version: string): string {
  return path.join(definitionPath, version, 'electron.d.ts');
}

/**
 * Do TypeScript definitions for the current version of Electron exist on disk?
 *
 * @param {string} version
 * @returns {boolean}
 */
export function getOfflineTypeDefinitions(version: string): boolean {
  return fs.existsSync(getOfflineTypeDefinitionPath(version));
}

/**
 * Get TypeScript definitions for a version of Electron. If none can be
 * found, returns null.
 *
 * @param {string} version
 * @returns {void}
 */
export async function getDownloadedVersionTypeDefs(
  version: RunnableVersion,
): Promise<string | null> {
  await fs.mkdirp(definitionPath);
  const offlinePath = getOfflineTypeDefinitionPath(version.version);

  if (getOfflineTypeDefinitions(version.version)) {
    try {
      return await fs.readFile(offlinePath, 'utf-8');
    } catch (error) {
      return null;
    }
  } else {
    const typeDefs = await fetchTypeDefinitions(version.version);
    if (typeDefs && typeDefs.length > 0) {
      try {
        await fs.outputFile(offlinePath, typeDefs);

        return typeDefs;
      } catch (error) {
        console.warn(`Fetch Types: Could not write to disk`, error);
        return typeDefs;
      }
    }
    return null;
  }
}

export async function getLocalVersionTypeDefs(version: RunnableVersion) {
  if (version.source === VersionSource.local && !!version.localPath) {
    const typesPath = getLocalTypePathForVersion(version);
    if (!!typesPath && fs.existsSync(typesPath)) {
      return fs.readFile(typesPath, 'utf-8');
    }
  }
  return null;
}

/**
 * Tries to update the editor with type definitions.
 *
 * @param {string} version
 */
export async function updateEditorTypeDefinitions(
  version: RunnableVersion,
): Promise<void> {
  const { app, monaco } = window.ElectronFiddle;
  const typeDefDisposable: MonacoType.IDisposable = app.typeDefDisposable!;

  const getTypeDefs =
    version.source === VersionSource.local
      ? getLocalVersionTypeDefs
      : getDownloadedVersionTypeDefs;

  const typeDefs = await getTypeDefs(version);

  if (typeDefDisposable) {
    typeDefDisposable.dispose();
  }

  if (typeDefs) {
    console.log(
      `Fetch Types: Updating Monaco types with electron.d.ts@${version.version}`,
    );
    const disposable = monaco.languages.typescript.javascriptDefaults.addExtraLib(
      typeDefs,
    );
    window.ElectronFiddle.app.typeDefDisposable = disposable;
  } else {
    console.log(`Fetch Types: No type definitions for ${version.version} 😢`);
  }
}

export function getLocalTypePathForVersion(version: RunnableVersion) {
  if (version.localPath) {
    return path.join(
      version.localPath,
      'gen',
      'electron',
      'tsc',
      'typings',
      'electron.d.ts',
    );
  } else {
    return null;
  }
}
