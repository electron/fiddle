import * as fs from 'fs-extra';
import * as path from 'path';
import * as MonacoType from 'monaco-editor';

import { USER_DATA_PATH } from './constants';

const definitionPath = path.join(USER_DATA_PATH, 'electron-typedef');


/**
 * Fetch TypeScript definitions for the current version of Electron (online)
 *
 * @param {string} version
 * @returns {Promise<string>}
 */
export function fetchTypeDefinitions(version: string): Promise<string> {
  const url = `https://unpkg.com/electron@${version}/electron.d.ts`;

  return window.fetch(url)
    .then((response) => response.text())
    .catch((error) => {
      console.warn(`Fetch Types: Could not fetch definitions`, error);
      return '';
    });
}

/**
 * Get the path for offline TypeScript definitions
 *
 * @param {string} version
 * @returns {string}
 */
export function getOfflineTypeDefinitionPath(version: string): string {
  return path.join(definitionPath, 'electron-typedef', version, 'electron.d.ts');
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
 * Get TypeScript defintions for a version of Electron. If none can't be
 * found, returns null.
 *
 * @param {string} version
 * @returns {void}
 */
export async function getTypeDefinitions(version: string): Promise<string | null> {
  await fs.mkdirp(definitionPath);

  const offlinePath = getOfflineTypeDefinitionPath(version);

  if (getOfflineTypeDefinitions(version)) {
    try {
      return fs.readFile(offlinePath, 'utf-8');
    } catch (error) {
      return null;
    }
  } else {
    const typeDefs = await fetchTypeDefinitions(version);

    if (typeDefs && typeDefs.length > 0) {
      try {
        await fs.outputFile(offlinePath, typeDefs);

        return typeDefs;
      } catch (error) {
        console.warn(`Fetch Types: Could not write to disk`, error);
        return null;
      }
    }

    return null;
  }
}

/**
 * Tries to update the editor with type definitions.
 *
 * @param {string} version
 */
export async function updateEditorTypeDefinitions(version: string) {
  const monaco: typeof MonacoType = (window as any).electronFiddle.monaco;
  const typeDefs = await getTypeDefinitions(version);

  if ((window as any).electronFiddle.typeDefDisposable) {
    (window as any).electronFiddle.typeDefDisposable.dispose();
  }

  if (typeDefs) {
    console.log(`Fetch Types: Updating Monaco types with electron.d.ts@${version}`);
    const disposable = monaco.languages.typescript.javascriptDefaults.addExtraLib(typeDefs);
    (window as any).electronFiddle.typeDefDisposable = disposable;
  } else {
    console.log(`Fetch Types: No type definitons for ${version} 😢`);
  }
}
