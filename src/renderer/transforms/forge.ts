import { execSync } from 'child_process';

import { Files, PACKAGE_NAME } from '../../interfaces';
import { getElectronBinaryPath } from '../binary';
import { getForgeVersion } from '../../utils/get-package';

/**
 * This transform turns the files into an electron-forge
 * project.
 *
 * @param {Files} files
 * @returns {Promise<Files>}
 */
export async function forgeTransform(files: Files): Promise<Files> {
  if (files.get(PACKAGE_NAME)) {
    try {
      const parsed = JSON.parse(files.get(PACKAGE_NAME)!);

      parsed.config ||= {};
      parsed.devDependencies ||= {};
      parsed.scripts ||= {};
      const { config, devDependencies, scripts } = parsed;

      // devDependencies
      const forgeVersion = getForgeVersion();
      devDependencies['@electron-forge/cli'] = forgeVersion;
      devDependencies['@electron-forge/maker-deb'] = forgeVersion;
      devDependencies['@electron-forge/maker-rpm'] = forgeVersion;
      devDependencies['@electron-forge/maker-squirrel'] = forgeVersion;
      devDependencies['@electron-forge/maker-zip'] = forgeVersion;

      // Scripts
      scripts.start = 'electron-forge start';
      scripts.package = 'electron-forge package';
      scripts.make = 'electron-forge make';
      scripts.publish = 'electron-forge publish';
      scripts.lint = 'echo "No linting configured"';

      // electron-forge config
      config.forge = {};
      config.forge.packagerConfig = {};

      const nightlyVersion = devDependencies['electron-nightly'];
      if (nightlyVersion) {
        // Fetch forced ABI for nightly.
        const binaryPath = getElectronBinaryPath(nightlyVersion);
        const abi = execSync(
          `ELECTRON_RUN_AS_NODE=1 "${binaryPath}" -p process.versions.modules`,
        );

        config.forge.electronRebuildConfig = {
          forceABI: abi.toString().trim(),
        };
      }

      // electron-forge makers
      config.forge.makers = [
        {
          name: '@electron-forge/maker-squirrel',
        },
        {
          name: '@electron-forge/maker-zip',
          platforms: ['darwin'],
        },
        {
          name: '@electron-forge/maker-deb',
          config: {},
        },
        {
          name: '@electron-forge/maker-rpm',
          config: {},
        },
      ];

      files.set(PACKAGE_NAME, JSON.stringify(parsed, undefined, 2));
    } catch (error) {
      console.warn(`Forge Transform: Failed to parse package.json`, { error });
    }
  }

  return files;
}
