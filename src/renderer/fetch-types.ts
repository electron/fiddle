import * as fsType from 'fs-extra';
import * as MonacoType from 'monaco-editor';
import * as path from 'path';

import { callIn } from '../utils/call-in';
import { fancyImport } from '../utils/import';
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
  return path.join(definitionPath, version, 'electron.d.ts');
}

/**
 * Do TypeScript definitions for the current version of Electron exist on disk?
 *
 * @param {string} version
 * @returns {boolean}
 */
export async function getOfflineTypeDefinitions(version: string): Promise<boolean> {
  const fs = await fancyImport<typeof fsType>('fs-extra');
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
  const fs = await fancyImport<typeof fsType>('fs-extra');
  await fs.mkdirp(definitionPath);

  const offlinePath = getOfflineTypeDefinitionPath(version);

  if (await getOfflineTypeDefinitions(version)) {
    try {
      return await fs.readFile(offlinePath, 'utf-8');
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
        return typeDefs;
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
export async function updateEditorTypeDefinitions(version: string, i: number = 0): Promise<void> {
  const defer = async (): Promise<void> => {
    if (i > 10) {
      console.warn(`Fetch Types: Failed, dependencies do not exist`);
      return;
    }

    console.warn(`Fetch Types: Called too soon, deferring`);
    return callIn(i * 100 + 200, () => updateEditorTypeDefinitions(version, i + 1));
  };

  // If this method is called before we're ready, we'll delay this work a bit
  if (!window.ElectronFiddle.app || !window.ElectronFiddle.app.monaco) return defer();

  const { app } = window.ElectronFiddle;
  const monaco: typeof MonacoType = app.monaco!;
  const typeDefDisposable: MonacoType.IDisposable = app.typeDefDisposable!;
  const typeDefs = await getTypeDefinitions(version);

  if (typeDefDisposable) {
    typeDefDisposable.dispose();
  }

  if (typeDefs) {
    console.log(`Fetch Types: Updating Monaco types with electron.d.ts@${version}`);
    const disposable = monaco.languages.typescript.javascriptDefaults.addExtraLib(typeDefs);
    window.ElectronFiddle.app.typeDefDisposable = disposable;
  } else {
    console.log(`Fetch Types: No type definitions for ${version} 😢`);
  }
}
