import { forgeTransform} from '../../src/renderer/transforms/forge';

jest.mock('../../src/constants', () => ({
  PACKAGE_NAME: 'package.json'
}));

describe('forgeTransform()', () => {
  it('adds forge dependencies', async () => {
    const filesBefore = new Map();
    filesBefore.set('package.json', JSON.stringify({}));

    const files = await forgeTransform(filesBefore);
    expect(JSON.parse(files.get('package.json'))).toEqual({
      devDependencies: {
        '@electron-forge/cli': 'latest',
        '@electron-forge/maker-deb': 'latest',
        '@electron-forge/maker-rpm': 'latest',
        '@electron-forge/maker-squirrel': 'latest',
        '@electron-forge/maker-zip': 'latest'
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
