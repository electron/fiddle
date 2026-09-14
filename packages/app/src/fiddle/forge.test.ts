import { describe, expect, it } from 'vitest';

import { ErrorCode } from '../shared/errors';
import { forgeTransform, forgeTransformPackageJson } from './forge';
import { generatePackageJson } from './package-json';

const FORGE = '8.0.0-alpha.10';
const makers = [
  { name: '@electron-forge/maker-squirrel' },
  { name: '@electron-forge/maker-zip', platforms: ['darwin'] },
  { name: '@electron-forge/maker-deb', config: {} },
  { name: '@electron-forge/maker-rpm', config: {} },
];

function transform(input: Parameters<typeof generatePackageJson>[0], options: Partial<Parameters<typeof forgeTransformPackageJson>[1]> = {}) {
  return JSON.parse(forgeTransformPackageJson(generatePackageJson(input), { forgeVersion: FORGE, ...options }));
}

describe('forge transform', () => {
  it('omits forceABI when the nightly ABI is unparseable', () => {
    for (const nightlyAbi of ['', ' ', 'abc', '128abc', 'NaN', '-1']) {
      const pkg = transform({ name: 'x', electronVersion: '33.0.0-nightly.20240801' }, { nightlyAbi });
      expect(pkg.config.forge.electronRebuildConfig).toBeUndefined();
    }
  });

  // @feature save.forge-license save.forge-makers save.forge-scripts
  it('adds Forge config to a generated package.json', () => {
    const pkg = transform({ name: 'app', author: 'me', modules: { lodash: '1.0.0' }, electronVersion: '30.0.0' });
    expect(pkg).toEqual({
      name: 'app',
      productName: 'app',
      version: '1.0.0',
      main: './main.js',
      author: 'me',
      scripts: {
        start: 'electron-forge start',
        package: 'electron-forge package',
        make: 'electron-forge make',
        publish: 'electron-forge publish',
        lint: 'echo "No linting configured"',
      },
      dependencies: { lodash: '1.0.0' },
      devDependencies: {
        electron: '30.0.0',
        '@electron-forge/cli': FORGE,
        '@electron-forge/maker-squirrel': FORGE,
        '@electron-forge/maker-zip': FORGE,
        '@electron-forge/maker-deb': FORGE,
        '@electron-forge/maker-rpm': FORGE,
      },
      license: 'MIT',
      config: { forge: { packagerConfig: {}, makers } },
    });
  });

  it('keeps an existing license', () => {
    const text = forgeTransformPackageJson(JSON.stringify({ name: 'x', license: 'ISC' }), { forgeVersion: FORGE });
    expect(JSON.parse(text).license).toBe('ISC');
  });

  // @feature save.forge-local
  it('sets forceABI for nightlies from the injected ABI', () => {
    const pkg = transform({ name: 'x', electronVersion: '33.0.0-nightly.20240801' }, { nightlyAbi: ' 128\n' });
    expect(pkg.config.forge.electronRebuildConfig).toEqual({ forceABI: 128 });
    expect(transform({ name: 'x', electronVersion: '33.0.0-nightly.20240801' }).config.forge.electronRebuildConfig).toBeUndefined();
    expect(transform({ name: 'x', electronVersion: '30.0.0' }, { nightlyAbi: 128 }).config.forge.electronRebuildConfig).toBeUndefined();
  });

  // @feature save.forge-local
  it('uses plugin-local-electron for local builds', () => {
    const pkg = transform(
      { name: 'x', electronVersion: '0.0.0-local.1' },
      { localElectronPath: '/src/out/Testing', latestStableVersion: '31.2.0' },
    );
    expect(pkg.devDependencies['@electron-forge/plugin-local-electron']).toBe(FORGE);
    expect(pkg.devDependencies.electron).toBe('31.2.0');
    expect(pkg.config.forge.plugins).toEqual([
      { name: '@electron-forge/plugin-local-electron', config: { electronPath: '/src/out/Testing' } },
    ]);
    const withoutLatest = transform({ name: 'x', electronVersion: '0.0.0-local.1' }, { localElectronPath: '/p' });
    expect(withoutLatest.devDependencies.electron).toBeUndefined();
  });

  it('replaces existing Forge config and scripts', () => {
    const text = JSON.stringify({ scripts: { test: 'x', start: 'old' }, config: { other: 1, forge: { old: true } } });
    const pkg = JSON.parse(forgeTransformPackageJson(text, { forgeVersion: FORGE }));
    expect(pkg.scripts.test).toBe('x');
    expect(pkg.scripts.start).toBe('electron-forge start');
    expect(pkg.config).toEqual({ other: 1, forge: { packagerConfig: {}, makers } });
  });

  it('throws on invalid or missing package.json', () => {
    expect(() => forgeTransformPackageJson('{ nope', { forgeVersion: FORGE })).toThrow(
      expect.objectContaining({ code: ErrorCode.invalidArgument }),
    );
    expect(() => forgeTransformPackageJson('[]', { forgeVersion: FORGE })).toThrow();
    expect(() => forgeTransform({ 'main.js': 'x' }, { forgeVersion: FORGE })).toThrow(
      expect.objectContaining({ details: { reason: 'missing-package-json' } }),
    );
  });

  it('transforms the package.json inside a file map', () => {
    const files = { 'main.js': 'x', 'package.json': generatePackageJson({ name: 'x' }) };
    const result = forgeTransform(files, { forgeVersion: FORGE });
    expect(result['main.js']).toBe('x');
    expect(JSON.parse(result['package.json']!).license).toBe('MIT');
    expect(JSON.parse(files['package.json']).license).toBeUndefined();
  });
});
