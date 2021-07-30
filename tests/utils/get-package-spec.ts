import * as semver from 'semver';

import { DefaultEditorId } from '../../src/interfaces';
import { getForgeVersion, getPackageJson } from '../../src/utils/get-package';

jest.mock('../../src/utils/get-username', () => ({
  getUsername: () => 'test-user',
}));

jest.mock('../../src/renderer/npm', () => ({
  findModulesInEditors: () => ['say'],
}));

describe('getForgeVersion', () => {
  it('returns a semver version', () => {
    const version = getForgeVersion();
    expect(typeof version).toEqual('string');
    expect(version).toBeTruthy();
    expect(semver.validRange(version)).toBeTruthy();
  });
});

describe('get-package', () => {
  it('getPackageJson() returns a default package.json', async () => {
    const result = await getPackageJson(
      {
        getName: () => 'test-app',
      } as any,
      {
        [DefaultEditorId.main]: 'app.goDoTheThing()',
        [DefaultEditorId.renderer]: `const say = require('say')`,
        [DefaultEditorId.html]: '<html />',
        [DefaultEditorId.preload]: 'preload',
        [DefaultEditorId.css]: 'body { color: black }',
      },
    );

    expect(result).toEqual(
      JSON.stringify(
        {
          name: 'test-app',
          productName: 'test-app',
          description: 'My Electron application description',
          keywords: [],
          main: './main.js',
          version: '1.0.0',
          author: 'test-user',
          scripts: {
            start: 'electron .',
          },
          dependencies: {
            say: '*',
          },
          devDependencies: {},
        },
        undefined,
        2,
      ),
    );
  });

  it('getPackageJson() includes electron-nightly if needed', async () => {
    const result = await getPackageJson(
      {
        getName: () => 'test-app',
        version: '1.0.0-nightly.123456789',
      } as any,
      {
        [DefaultEditorId.main]: 'app.goDoTheThing()',
        [DefaultEditorId.renderer]: `const say = require('say')`,
        [DefaultEditorId.html]: '<html />',
        [DefaultEditorId.preload]: 'preload',
        [DefaultEditorId.css]: 'body { color: black }',
      },
      {
        includeElectron: true,
        includeDependencies: true,
      },
    );

    expect(result).toEqual(
      JSON.stringify(
        {
          name: 'test-app',
          productName: 'test-app',
          description: 'My Electron application description',
          keywords: [],
          main: './main.js',
          version: '1.0.0',
          author: 'test-user',
          scripts: {
            start: 'electron .',
          },
          dependencies: {
            say: '*',
          },
          devDependencies: {
            'electron-nightly': '1.0.0-nightly.123456789',
          },
        },
        undefined,
        2,
      ),
    );
  });

  it('getPackageJson() includes electron if needed', async () => {
    const result = await getPackageJson(
      {
        getName: () => 'test-app',
        version: '1.0.0',
      } as any,
      {
        [DefaultEditorId.main]: 'app.goDoTheThing()',
        [DefaultEditorId.renderer]: `const say = require('say')`,
        [DefaultEditorId.html]: '<html />',
        [DefaultEditorId.preload]: 'preload',
        [DefaultEditorId.css]: 'body { color: black }',
      },
      {
        includeElectron: true,
        includeDependencies: true,
      },
    );

    expect(result).toEqual(
      JSON.stringify(
        {
          name: 'test-app',
          productName: 'test-app',
          description: 'My Electron application description',
          keywords: [],
          main: './main.js',
          version: '1.0.0',
          author: 'test-user',
          scripts: {
            start: 'electron .',
          },
          dependencies: {
            say: '*',
          },
          devDependencies: {
            electron: '1.0.0',
          },
        },
        undefined,
        2,
      ),
    );
  });
});
