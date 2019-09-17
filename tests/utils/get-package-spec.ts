import { getPackageJson } from '../../src/utils/get-package';

jest.mock('../../src/utils/get-username', () => ({
  getUsername: () => 'test-user'
}));

jest.mock('../../src/renderer/npm', () => ({
  findModulesInEditors: () => [ 'say' ]
}));

describe('get-package', () => {
  it('getPackageJson() returns a default package.json', async () => {
    const result = await getPackageJson({
      getName: () => 'test-app'
    } as any, {
      main: 'app.goDoTheThing()',
      renderer: `const say = require('say')`,
      html: '<html />',
      preload: 'preload'
    });

    expect(result).toEqual(JSON.stringify({
      name: 'test-app',
      productName: 'test-app',
      description: 'My Electron application description',
      keywords: [],
      main: './main.js',
      version: '1.0.0',
      author: 'test-user',
      scripts: {
        start: 'electron .'
      },
      dependencies: {
        say: '*'
      },
      devDependencies: {}
    }, undefined, 2));
  });

  it('getPackageJson() includes electron if needed', async () => {
    const result = await getPackageJson({
      getName: () => 'test-app',
      version: '1.0.0'
    } as any, {
      main: 'app.goDoTheThing()',
      renderer: `const say = require('say')`,
      html: '<html />',
      preload: 'preload'
    }, {
      includeElectron: true,
      includeDependencies: true
    });

    expect(result).toEqual(JSON.stringify({
      name: 'test-app',
      productName: 'test-app',
      description: 'My Electron application description',
      keywords: [],
      main: './main.js',
      version: '1.0.0',
      author: 'test-user',
      scripts: {
        start: 'electron .'
      },
      dependencies: {
        say: '*'
      },
      devDependencies: {
        electron: '1.0.0'
      }
    }, undefined, 2));
  });
});
