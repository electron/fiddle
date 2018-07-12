import * as path from 'path';

import { AppState } from '../renderer/state';
import { UNTITLED_NAME } from '../constants';
import { EditorValues } from '../interfaces';
import { findModulesInEditors } from '../renderer/npm';
import { getUsername } from './get-username';

export interface PackageJsonOptions {
  includeElectron?: boolean;
  includeDependencies?: boolean;
}

/**
 * Returns the package.json for the current Fiddle
 *
 * @param {AppState} appState
 * @param {EditorValues} [values]
 * @param {PackageJsonOptions} [options]
 * @returns {string}
 */
export async function getPackageJson(
  appState: AppState, values?: EditorValues, options?: PackageJsonOptions
): Promise<string> {
  const { includeElectron, includeDependencies } = options || {
    includeElectron: false,
    includeDependencies: false
  };

  const name = appState.localPath
    ? path.basename(appState.localPath)
    : UNTITLED_NAME;

  const devDependencies: Record<string, string> = {};
  const dependencies: Record<string, string> = {};

  if (includeElectron) {
    devDependencies.electron = appState.version;
  }

  if (includeDependencies && values) {
    const modules = await findModulesInEditors(values);
    modules.forEach((module) => {
      dependencies[module] = '*';
    });
  }

  return JSON.stringify({
    name,
    productName: name,
    description: 'My Electron application description',
    keywords: [],
    main: './main.js',
    version: '1.0.0',
    author: getUsername(),
    scripts: {
      start: 'electron .'
    },
    dependencies,
    devDependencies
  }, undefined, 2);
}
