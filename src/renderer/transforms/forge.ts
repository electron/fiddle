import { Files } from '../../interfaces';
import { PACKAGE_NAME } from '../../constants';

/**
 * This transform turns the files into an electron-forge
 * project.
 *
 * @param {Files} files
 * @returns {Files}
 */
export function forgeTransform(files: Files): Files {
  if (files[PACKAGE_NAME]) {
    try {
      const parsed = JSON.parse(files[PACKAGE_NAME]);

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

      // electron-forge makers
      parsed.config.forge.makers = [
        {
          name: '@electron-forge/maker-squirrel',
          config: {
            name: 'test'
          }
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
    } catch (error) {
      console.warn(`Forge Transform: Failed to parse package.json`, { error });
    }
  }

  return files;
}
