import * as fiddlePackageJSON from '../../../package.json';
import { MAIN_JS, PackageJsonOptions } from '../../interfaces';
import { AppState } from '../../renderer/state';

export const DEFAULT_OPTIONS = {
  includeElectron: true,
  includeDependencies: true,
};

export function getForgeVersion(): string {
  return fiddlePackageJSON.devDependencies['@electron-forge/cli'];
}

/**
 * Returns the package.json for the current Fiddle
 */
export async function getPackageJson(
  appState: AppState,
  options?: PackageJsonOptions,
): Promise<string> {
  const { includeElectron, includeDependencies } = options || DEFAULT_OPTIONS;
  const name = await appState.getName();

  const devDependencies: Record<string, string> = {};
  const dependencies: Record<string, string> = {};

  if (includeElectron) {
    const packageName = appState.version?.includes('nightly')
      ? 'electron-nightly'
      : 'electron';
    devDependencies[packageName] = appState.version;
  }

  if (includeDependencies) {
    const { modules } = appState;
    for (const [module, version] of modules.entries()) {
      dependencies[module] = version;
    }
  }

  const entryPoint = appState.editorMosaic.mainEntryPointFile() ?? MAIN_JS;

  return JSON.stringify(
    {
      name,
      productName: name,
      description: 'My Electron application description',
      keywords: [],
      main: `./${entryPoint}`,
      version: '1.0.0',
      author: appState.packageAuthor,
      scripts: {
        start: 'electron .',
      },
      dependencies,
      devDependencies,
    },
    undefined,
    2,
  );
}
