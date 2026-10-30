import { describe, expect, it } from 'vitest';

import { ErrorCode, FiddleError } from '../shared/errors';
import {
  DEFAULT_DESCRIPTION,
  electronPackageName,
  generatePackageJson,
  parsePackageJson,
  stripRangePrefix,
  toPackageName,
} from './package-json';

describe('generatePackageJson', () => {
  it('writes every field, in the original order', () => {
    const text = generatePackageJson({
      name: 'sleepy-golden-otter',
      main: 'main.mjs',
      author: 'octocat',
      modules: { lodash: '4.17.21' },
      electronVersion: '30.0.0',
    });
    const pkg = JSON.parse(text);
    expect(pkg).toEqual({
      name: 'sleepy-golden-otter',
      productName: 'sleepy-golden-otter',
      description: DEFAULT_DESCRIPTION,
      keywords: [],
      main: './main.mjs',
      version: '1.0.0',
      author: 'octocat',
      scripts: { start: 'electron .' },
      dependencies: { lodash: '4.17.21' },
      devDependencies: { electron: '30.0.0' },
    });
    expect(Object.keys(pkg)).toEqual([
      'name',
      'productName',
      'description',
      'keywords',
      'main',
      'version',
      'author',
      'scripts',
      'dependencies',
      'devDependencies',
    ]);
    expect(text).toContain('\n  "name"');
  });

  it('always has a description, because Forge’s deb, rpm and Squirrel makers need one', () => {
    const pkg = JSON.parse(generatePackageJson({ name: 'x' }));
    expect(pkg.description).toMatch(/\S/);
  });

  it('uses electron-nightly for nightlies', () => {
    const pkg = JSON.parse(
      generatePackageJson({ name: 'x', electronVersion: '32.0.0-nightly.20240101' }),
    );
    expect(pkg.devDependencies).toEqual({
      'electron-nightly': '32.0.0-nightly.20240101',
    });
    expect(electronPackageName('30.0.0-beta.1')).toBe('electron');
  });

  it('writes a valid package name, however the fiddle is named', () => {
    const pkg = JSON.parse(generatePackageJson({ name: 'My Fiddle' }));
    expect(pkg.name).toBe('my-fiddle');
    expect(pkg.productName).toBe('my-fiddle');
    expect(toPackageName('.hidden_Thing!!')).toBe('hidden_thing');
    expect(toPackageName('foo_')).toBe('foo');
    expect(toPackageName('\u2605')).toBe('fiddle');
    expect(toPackageName('a'.repeat(300))).toHaveLength(214);
  });

  it('leaves out optional parts', () => {
    const pkg = JSON.parse(generatePackageJson({ name: 'x' }));
    expect(pkg).toEqual({
      name: 'x',
      productName: 'x',
      description: DEFAULT_DESCRIPTION,
      keywords: [],
      main: './main.js',
      version: '1.0.0',
      scripts: { start: 'electron .' },
    });
  });
});

describe('parsePackageJson', () => {
  it('accepts a byte order mark', () => {
    expect(
      parsePackageJson('\uFEFF{"dependencies":{"lodash":"4.17.21"}}').modules,
    ).toEqual({ lodash: '4.17.21' });
  });

  it('turns dependencies into modules and takes the Electron version', () => {
    const result = parsePackageJson(
      JSON.stringify({
        dependencies: { lodash: '^4.17.0', electron: '^30.1.2' },
        devDependencies: { '@types/node': '20.0.0' },
      }),
    );
    expect(result).toEqual({
      modules: { lodash: '^4.17.0', '@types/node': '20.0.0' },
      rejectedModules: [],
      electronVersion: '30.1.2',
    });
  });

  it('handles electron-nightly and ~ prefixes', () => {
    const result = parsePackageJson(
      JSON.stringify({
        devDependencies: { 'electron-nightly': '~33.0.0-nightly.20240801' },
      }),
    );
    expect(result.electronVersion).toBe('33.0.0-nightly.20240801');
    expect(result.modules).toEqual({});
  });

  it('reports an invalid Electron version and drops it from modules', () => {
    const result = parsePackageJson(
      JSON.stringify({ devDependencies: { electron: 'latest', left: '1.0.0' } }),
    );
    expect(result.electronVersion).toBeUndefined();
    expect(result.invalidElectronVersion).toBe('latest');
    expect(result.modules).toEqual({ left: '1.0.0' });
  });

  it('lists module specs it rejects', () => {
    const result = parsePackageJson(
      JSON.stringify({
        dependencies: {
          ok: '1.0.0',
          gitdep: 'git+https://github.com/a/b.git',
          filedep: 'file:../x',
          alias: 'npm:lodash@4',
          'Bad Name': '1.0.0',
          notstring: 5,
        },
      }),
    );
    expect(result.modules).toEqual({ ok: '1.0.0' });
    expect(result.rejectedModules).toEqual([
      { name: 'gitdep', spec: 'git+https://github.com/a/b.git', reason: 'invalid-spec' },
      { name: 'filedep', spec: 'file:../x', reason: 'invalid-spec' },
      { name: 'alias', spec: 'npm:lodash@4', reason: 'invalid-spec' },
      { name: 'Bad Name', spec: '1.0.0', reason: 'invalid-name' },
    ]);
  });

  it('is safe with __proto__ keys', () => {
    const result = parsePackageJson('{"dependencies":{"__proto__":"1.0.0","a":"1.0.0"}}');
    expect(Object.getPrototypeOf(result.modules)).toBe(Object.prototype);
    expect(result.modules.a).toBe('1.0.0');
  });

  it.each(['{ nope', '', '[]', '"str"', 'null'])('throws on invalid JSON %j', (text) => {
    try {
      parsePackageJson(text);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(FiddleError);
      expect((error as FiddleError).code).toBe(ErrorCode.invalidArgument);
      expect((error as FiddleError).details).toMatchObject({ reason: 'invalid-json' });
    }
  });

  it('accepts a package.json with no dependencies', () => {
    expect(parsePackageJson('{"name":"x"}')).toEqual({
      modules: {},
      rejectedModules: [],
    });
  });
});

describe('stripRangePrefix', () => {
  it('strips up to the first digit', () => {
    expect(stripRangePrefix('^1.2.0')).toBe('1.2.0');
    expect(stripRangePrefix('~2.3.4')).toBe('2.3.4');
    expect(stripRangePrefix('>=3.0.0')).toBe('3.0.0');
    expect(stripRangePrefix('latest')).toBe('latest');
  });
});
