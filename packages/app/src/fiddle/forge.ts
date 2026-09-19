import { ErrorCode, FiddleError } from '../shared/errors';
import { type FileMap, PACKAGE_JSON } from './files';

export const FORGE_CLI = '@electron-forge/cli';
export const FORGE_PLUGIN_LOCAL_ELECTRON = '@electron-forge/plugin-local-electron';
export const FORGE_MAKERS = [
  '@electron-forge/maker-squirrel',
  '@electron-forge/maker-zip',
  '@electron-forge/maker-deb',
  '@electron-forge/maker-rpm',
] as const;

export interface ForgeTransformOptions {
  forgeVersion: string;
  /** The nightly's `modules` (ABI) from the release list; sets `forceABI` for `electron-nightly`. */
  nightlyAbi?: number | string;
  /** A local build's path: adds `plugin-local-electron`. */
  localElectronPath?: string;
  /** Replaces the `electron` devDependency for local builds so `npm install` works. Removed if unset. */
  latestStableVersion?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidPackageJson(): FiddleError {
  return new FiddleError(
    ErrorCode.invalidArgument,
    'Invalid JSON found in package.json',
    {
      reason: 'invalid-json',
      file: PACKAGE_JSON,
    },
  );
}

/** Turns a generated `package.json` into an Electron Forge project's. */
export function forgeTransformPackageJson(
  text: string,
  options: ForgeTransformOptions,
): string {
  let pkg: unknown;
  try {
    pkg = JSON.parse(text);
  } catch {
    throw invalidPackageJson();
  }
  if (!isRecord(pkg)) throw invalidPackageJson();

  if (!pkg.license) pkg.license = 'MIT';
  const devDependencies = isRecord(pkg.devDependencies) ? pkg.devDependencies : {};
  const scripts = isRecord(pkg.scripts) ? pkg.scripts : {};
  const config = isRecord(pkg.config) ? pkg.config : {};

  for (const name of [FORGE_CLI, ...FORGE_MAKERS])
    devDependencies[name] = options.forgeVersion;

  scripts.start = 'electron-forge start';
  scripts.package = 'electron-forge package';
  scripts.make = 'electron-forge make';
  scripts.publish = 'electron-forge publish';
  scripts.lint = 'echo "No linting configured"';

  const forge: Record<string, unknown> = { packagerConfig: {} };
  const abi = String(options.nightlyAbi ?? '').trim();
  if (devDependencies['electron-nightly'] && /^\d+$/.test(abi)) {
    forge.electronRebuildConfig = { forceABI: Number(abi) };
  }
  if (options.localElectronPath) {
    devDependencies[FORGE_PLUGIN_LOCAL_ELECTRON] = options.forgeVersion;
    forge.plugins = [
      {
        name: FORGE_PLUGIN_LOCAL_ELECTRON,
        config: { electronPath: options.localElectronPath },
      },
    ];
    if ('electron' in devDependencies) {
      if (options.latestStableVersion)
        devDependencies.electron = options.latestStableVersion;
      else delete devDependencies.electron;
    }
  }
  forge.makers = [
    { name: '@electron-forge/maker-squirrel' },
    { name: '@electron-forge/maker-zip', platforms: ['darwin'] },
    { name: '@electron-forge/maker-deb', config: {} },
    { name: '@electron-forge/maker-rpm', config: {} },
  ];
  config.forge = forge;

  pkg.devDependencies = devDependencies;
  pkg.scripts = scripts;
  pkg.config = config;
  return JSON.stringify(pkg, null, 2);
}

export function forgeTransform(files: FileMap, options: ForgeTransformOptions): FileMap {
  const text = files[PACKAGE_JSON];
  if (text === undefined) {
    throw new FiddleError(
      ErrorCode.invalidArgument,
      'The Forge transform needs a package.json',
      {
        reason: 'missing-package-json',
      },
    );
  }
  return { ...files, [PACKAGE_JSON]: forgeTransformPackageJson(text, options) };
}
