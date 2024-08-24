import { Files, PACKAGE_NAME } from '../../interfaces';
import { getForgeVersion } from '../utils/get-package';

/**
 * This transform turns the files into an electron-forge
 * project.
 */
export async function forgeTransform(files: Files): Promise<Files> {
  if (files.get(PACKAGE_NAME)) {
    try {
      const parsed = JSON.parse(files.get(PACKAGE_NAME)!);

      parsed.config ||= {};
      parsed.devDependencies ||= {};
      parsed.license ||= 'MIT';
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
        const { modules } = (await window.ElectronFiddle.getReleaseInfo(
          nightlyVersion,
        ))!;

        config.forge.electronRebuildConfig = {
          forceABI: parseInt(modules.toString().trim()),
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
