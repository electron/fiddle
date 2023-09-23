import { mocked } from 'jest-mock';
import * as semver from 'semver';

import { EditorId, MAIN_JS, MAIN_MJS } from '../../../src/interfaces';
import { AppState } from '../../../src/renderer/state';
import {
  getForgeVersion,
  getPackageJson,
} from '../../../src/renderer/utils/get-package';
import { StateMock } from '../../mocks/mocks';

describe('get-package', () => {
  describe('getForgeVersion()', () => {
    it('returns a semver-compatible version constraint', () => {
      const version = getForgeVersion();
      expect(typeof version).toEqual('string');
      expect(version).toBeTruthy();
      expect(semver.validRange(version)).toBeTruthy();
    });
  });

  describe('getPackageJson()', () => {
    beforeAll(() => {
      mocked(window.ElectronFiddle.getUsername).mockReturnValue('test-user');
    });

    const appState = new StateMock();
    const defaultName = 'test-app' as const;
    const defaultAuthor = 'test-user' as const;

    const defaultPackage = {
      name: defaultName,
      productName: defaultName,
      description: 'My Electron application description',
      keywords: [],
      main: `./${MAIN_JS}`,
      version: '1.0.0',
      author: defaultAuthor,
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

    it('returns a default package.json', async () => {
      const name = defaultName;
      const appState = {
        editorMosaic: {
          files: new Map<EditorId, unknown>(),
          mainEntryPointFile: () => MAIN_JS,
        },
        getName: () => name,
        modules: new Map<string, string>([['say', '*']]),
        packageAuthor: defaultAuthor,
      };
      const result = await getPackageJson(appState as unknown as AppState);
      expect(result).toEqual(buildExpectedPackage());
    });

    it('can use an ESM entry point', async () => {
      const name = defaultName;
      const appState = {
        editorMosaic: {
          files: new Map<EditorId, unknown>([[MAIN_MJS, '']]),
          mainEntryPointFile: () => MAIN_MJS,
        },
        getName: () => name,
        modules: new Map<string, string>([['say', '*']]),
        packageAuthor: defaultAuthor,
      };
      const result = await getPackageJson(appState as unknown as AppState);
      expect(JSON.parse(result)).toMatchObject({
        main: `./${MAIN_MJS}`,
      });
    });

    it.each([
      ['can include electron', '13.0.0', 'electron'],
      ['can include electron-nightly', '13.0.0-nightly.12', 'electron-nightly'],
    ])('%s', async (_, version: string, electronPkg: string) => {
      const name = defaultName;
      appState.getName.mockReturnValue(name);
      appState.modules = new Map<string, string>([['say', '*']]);
      appState.version = version;
      appState.packageAuthor = defaultAuthor;

      const result = await getPackageJson(appState as unknown as AppState);
      const devDependencies = { [electronPkg]: version };
      expect(result).toEqual(buildExpectedPackage({ name, devDependencies }));
    });
  });
});
