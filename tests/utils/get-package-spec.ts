import * as semver from 'semver';

import { MAIN_JS } from '../../src/interfaces';
import { getForgeVersion, getPackageJson } from '../../src/utils/get-package';
import { StateMock } from '../mocks/mocks';

jest.mock('../../src/utils/get-username', () => ({
  getUsername: () => 'test-user',
}));

jest.mock('../../src/renderer/npm', () => ({
  findModulesInEditors: () => ['say'],
}));

describe('get-package', () => {
  describe('getForgeVersion', () => {
    it('returns a semver-compatible version constraint', () => {
      const version = getForgeVersion();
      expect(typeof version).toEqual('string');
      expect(version).toBeTruthy();
      expect(semver.validRange(version)).toBeTruthy();
    });
  });

  describe('getPackageJson()', () => {
    const appState = new StateMock();
    const defaultName = 'test-app' as const;

    const editorValues = {
      [MAIN_JS]: `const say = require('say')`,
    } as const;

    const defaultPackage = {
      name: defaultName,
      productName: defaultName,
      description: 'My Electron application description',
      keywords: [],
      main: `./${MAIN_JS}`,
      version: '1.0.0',
      author: 'test-user',
      scripts: {
        start: 'electron .',
      },
      dependencies: {
        say: '*',
      },
      devDependencies: {},
    } as const;

    function buildExpectedPackage(opts: Record<string, unknown> = {}) {
      return JSON.stringify({ ...defaultPackage, ...opts }, null, 2);
    }

    it('getPackageJson() returns a default package.json', async () => {
      const name = defaultName;
      const appState = { getName: () => name };
      const result = await getPackageJson(appState as any, editorValues);
      expect(result).toEqual(buildExpectedPackage());
    });

    it.each([
      ['can include electron', '13.0.0', 'electron'],
      ['can include electron-nightly', '13.0.0-nightly.12', 'electron-nightly'],
    ])('%s', async (_, version: string, electronPkg: string) => {
      const name = defaultName;
      appState.getName.mockReturnValue(name);
      appState.version = version;

      const result = await getPackageJson(appState as any, editorValues);
      const devDependencies = { [electronPkg]: version };
      expect(result).toEqual(buildExpectedPackage({ name, devDependencies }));
    });
  });
});
