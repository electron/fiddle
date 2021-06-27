import { PACKAGE_NAME } from '../../src/interfaces';
import { forgeTransform } from '../../src/renderer/transforms/forge';

describe('forgeTransform()', () => {
  it('adds forge dependencies', () => {
    const filesBefore = new Map();
    filesBefore.set(PACKAGE_NAME, JSON.stringify({}));

    const files = forgeTransform(filesBefore);
    expect(JSON.parse(files.get(PACKAGE_NAME)!)).toEqual({
      devDependencies: {
        '@electron-forge/cli': '6.0.0-beta.52',
        '@electron-forge/maker-deb': '6.0.0-beta.52',
        '@electron-forge/maker-rpm': '6.0.0-beta.52',
        '@electron-forge/maker-squirrel': '6.0.0-beta.52',
        '@electron-forge/maker-zip': '6.0.0-beta.52',
      },
      scripts: {
        start: 'electron-forge start',
        package: 'electron-forge package',
        make: 'electron-forge make',
        publish: 'electron-forge publish',
        lint: 'echo "No linting configured"',
      },
      config: {
        forge: {
          packagerConfig: {},
          makers: [
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
          ],
        },
      },
    });
  });

  it('deals with errors', () => {
    const filesBefore = new Map();
    filesBefore.set(PACKAGE_NAME, 'garbage');

    const files = forgeTransform(filesBefore);
    expect(files.get(PACKAGE_NAME)).toBe('garbage');
  });
});
