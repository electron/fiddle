import { describe, expect, it } from 'vitest';

import { ErrorCode } from '../shared/errors';
import { pickFiddleFiles } from './pick';

describe('pickFiddleFiles', () => {
  it('keeps supported files, skips the rest, and lists unknown ones', () => {
    const result = pickFiddleFiles({
      'main.js': 'main',
      'index.html': '<p/>',
      'helper.js': 'x',
      'README.md': '# hi',
      'package-lock.json': '{}',
      'Package.json': '{}',
      'INDEX.html': 'same name, other case',
    });
    expect(result.files).toEqual({ 'main.js': 'main', 'index.html': '<p/>', 'helper.js': 'x' });
    expect(result.skipped).toEqual(['README.md', 'package-lock.json', 'Package.json', 'INDEX.html']);
    expect(result.unknown).toEqual(['helper.js']);
    expect(result.packageJson).toBeUndefined();
    expect(result.modules).toEqual({});
  });

  it('adds a main entry, but not next to a differently-cased one', () => {
    expect(pickFiddleFiles({ 'index.html': '<p/>' }).files).toEqual({ 'index.html': '<p/>', 'main.js': '// Empty' });
    expect(pickFiddleFiles({ 'Main.js': 'mine' }).files).toEqual({ 'Main.js': 'mine' });
  });

  it.each<Record<string, string>>([{}, { 'README.md': 'x', 'package.json': '{}' }, { 'package-lock.json': '{}' }])(
    'throws when there are no supported files: %j',
    (map) => {
      expect(() => pickFiddleFiles(map)).toThrow(
        expect.objectContaining({ code: ErrorCode.invalidArgument, details: expect.objectContaining({ reason: 'no-supported-files' }) }),
      );
    },
  );

  it('reads modules and the Electron version from package.json', () => {
    const packageJson = JSON.stringify({ dependencies: { lodash: '4.17.21' }, devDependencies: { electron: '^30.0.0' } });
    const result = pickFiddleFiles({ 'main.js': 'x', 'package.json': packageJson }, { previousModules: { old: '1.0.0' } });
    expect(result.modules).toEqual({ lodash: '4.17.21' });
    expect(result.packageJson).toMatchObject({ electronVersion: '30.0.0' });
    expect(result.files).toEqual({ 'main.js': 'x' });
    expect(result.skipped).toEqual([]);
  });

  it('keeps the previous modules without a valid package.json', () => {
    const previousModules = { old: '1.0.0' };
    expect(pickFiddleFiles({ 'main.js': 'x' }, { previousModules }).modules).toEqual(previousModules);
    const invalid = pickFiddleFiles({ 'main.js': 'x', 'package.json': '{ nope' }, { previousModules });
    expect(invalid.modules).toEqual(previousModules);
    expect(invalid.packageJson).toBeUndefined();
    expect(invalid.packageJsonError).toMatchObject({ code: ErrorCode.invalidArgument, details: { reason: 'invalid-json' } });
  });
});
