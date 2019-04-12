import { forgeTransform} from '../../src/renderer/transforms/forge';

jest.mock('../../src/shared-constants', () => ({
  PACKAGE_NAME: 'package.json'
}));

describe('forgeTransform()', () => {
  it('adds forge dependencies', async () => {
    const filesBefore = new Map();
    filesBefore.set('package.json', JSON.stringify({}));

    const files = await forgeTransform(filesBefore);
    expect(JSON.parse(files.get('package.json')!)).toEqual({
      devDependencies: {
        '@electron-forge/cli': '6.0.0-beta.34',
        '@electron-forge/maker-deb': '6.0.0-beta.34',
        '@electron-forge/maker-rpm': '6.0.0-beta.34',
        '@electron-forge/maker-squirrel': '6.0.0-beta.34',
        '@electron-forge/maker-zip': '6.0.0-beta.34'
      },
      scripts: {
        start: 'electron-forge start',
        package: 'electron-forge package',
        make: 'electron-forge make',
        publish: 'electron-forge publish',
        lint: 'echo "No linting configured"'
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
          ]
        }
      }
    });
  });

  it('deals with errors', async () => {
    const filesBefore = new Map();
    filesBefore.set('package.json', 'garbage');

    const files = await forgeTransform(filesBefore);
    expect(files.get('package.json')).toBe('garbage');
  });
});
