import { execSync } from 'child_process';
import { Files } from '../../interfaces';
import { PACKAGE_NAME } from '../../shared-constants';
import { getElectronBinaryPath } from '../binary';

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

      // devDependencies
      parsed.devDependencies = parsed.devDependencies || {};
      parsed.devDependencies['@electron-forge/cli'] = '6.0.0-beta.34';
      parsed.devDependencies['@electron-forge/maker-deb'] = '6.0.0-beta.34';
      parsed.devDependencies['@electron-forge/maker-rpm'] = '6.0.0-beta.34';
      parsed.devDependencies['@electron-forge/maker-squirrel'] = '6.0.0-beta.34';
      parsed.devDependencies['@electron-forge/maker-zip'] = '6.0.0-beta.34';

      // Scripts
      parsed.scripts = parsed.scripts || {};
      parsed.scripts.start = 'electron-forge start';
      parsed.scripts.package = 'electron-forge package';
      parsed.scripts.make = 'electron-forge make';
      parsed.scripts.publish = 'electron-forge publish';
      parsed.scripts.lint = 'echo "No linting configured"';

      // electron-forge config
      parsed.config = parsed.config || {};
      parsed.config.forge = {};
      parsed.config.forge.packagerConfig = {};

      if (parsed.devDependencies.electron) {
        const electronVersion = parsed.devDependencies.electron;

        // Update module name to nightly.
        if (electronVersion.includes('nightly')) {
          delete parsed.devDependencies.electron;
          parsed.devDependencies['electron-nightly'] = electronVersion;

          // Fetch forced ABI for nightly.
          const binaryPath = getElectronBinaryPath(electronVersion);
          const abi = execSync(`ELECTRON_RUN_AS_NODE=1 "${binaryPath}" -p process.versions.modules`);

          parsed.config.forge.electronRebuildConfig = {
            forceABI: abi.toString().trim()
          };
        }
      }

      // electron-forge makers
      parsed.config.forge.makers = [
        {
          name: '@electron-forge/maker-squirrel',
        },
        {
          name: '@electron-forge/maker-zip',
          platforms: [
            'darwin'
          ]
        },
        {
          name: '@electron-forge/maker-deb',
          config: {}
        },
        {
          name: '@electron-forge/maker-rpm',
          config: {}
        }
      ];

      files.set(PACKAGE_NAME, JSON.stringify(parsed, undefined, 2));
    } catch (error) {
      console.warn(`Forge Transform: Failed to parse package.json`, { error });
    }
  }

  return files;
}
