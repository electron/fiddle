import { describe, expect, it } from 'vitest';

import { ErrorCode, FiddleError } from '../shared/errors';
import {
  assertCanAddFile,
  assertCanRemoveFile,
  assertCanRenameFile,
  assertValidFileName,
  assertValidFileSet,
  ensureMainEntry,
  findMainEntry,
  getEditorLanguage,
  getExtension,
  getPlaceholder,
  isEmptyOrPlaceholder,
  isKnownFile,
  isMainEntry,
  isReservedFileName,
  isSupportedFileName,
  sortFileNames,
} from './files';
import { thrownReason } from './test-helpers/errors';

describe('isSupportedFileName', () => {
  it.each(['main.js', 'a.cjs', 'b.mjs', 'index.html', 'styles.css', 'data.json', 'STYLE.CSS', 'App.MJS', 'a.b.js'])(
    'accepts %s',
    (name) => expect(isSupportedFileName(name)).toBe(true),
  );

  it.each(['readme.md', 'a.ts', 'a/b.js', 'a\\b.js', '.js', '', 'noext', 'main.js\0', 'C:x.js', 'a?.js', 'a*.js', 'a|b.js', 'a<b.js', 'a"b.js', 'tab\t.js'])('rejects %j', (name) =>
    expect(isSupportedFileName(name)).toBe(false),
  );
});

describe('names', () => {
  it('finds extensions in lower case', () => {
    expect(getExtension('A.B.JS')).toBe('.js');
    expect(getExtension('.gitignore')).toBe('');
    expect(getExtension('none')).toBe('');
  });

  it('knows reserved names in any case', () => {
    expect(isReservedFileName('package.json')).toBe(true);
    expect(isReservedFileName('Package-Lock.json')).toBe(true);
    expect(isReservedFileName('packages.json')).toBe(false);
  });

  it('knows the main entries', () => {
    expect(isMainEntry('main.js')).toBe(true);
    expect(isMainEntry('main.cjs')).toBe(true);
    expect(isMainEntry('main.mjs')).toBe(true);
    expect(isMainEntry('main.ts')).toBe(false);
    expect(isMainEntry('index.js')).toBe(false);
    expect(findMainEntry(['index.html', 'main.mjs'])).toBe('main.mjs');
    expect(findMainEntry(['index.html'])).toBeUndefined();
  });

  it('finds main entries in any case, so no second main.js is added next to Main.js', () => {
    expect(isMainEntry('Main.js')).toBe(true);
    expect(isMainEntry('MAIN.MJS')).toBe(true);
    expect(findMainEntry(['index.html', 'Main.js'])).toBe('Main.js');
    expect(ensureMainEntry({ 'Main.js': 'mine' })).toEqual({ 'Main.js': 'mine' });
  });

  it('knows the known files', () => {
    expect(isKnownFile('preload.js')).toBe(true);
    expect(isKnownFile('other.js')).toBe(false);
  });
});

describe('languages and placeholders', () => {
  it('maps extensions to editor languages', () => {
    expect(getEditorLanguage('a.js')).toBe('javascript');
    expect(getEditorLanguage('a.cjs')).toBe('javascript');
    expect(getEditorLanguage('a.MJS')).toBe('javascript');
    expect(getEditorLanguage('a.html')).toBe('html');
    expect(getEditorLanguage('a.css')).toBe('css');
    expect(getEditorLanguage('a.json')).toBe('json');
  });

  it('has a placeholder per language', () => {
    expect(getPlaceholder('a.js')).toBe('// Empty');
    expect(getPlaceholder('a.cjs')).toBe('// Empty');
    expect(getPlaceholder('a.mjs')).toBe('// Empty');
    expect(getPlaceholder('a.html')).toBe('<!-- Empty -->');
    expect(getPlaceholder('a.css')).toBe('/* Empty */');
    expect(getPlaceholder('a.json')).toBe('{}');
    expect(getPlaceholder('a.txt')).toBe('');
  });

  it('detects empty and placeholder-only files', () => {
    expect(isEmptyOrPlaceholder('a.js', '')).toBe(true);
    expect(isEmptyOrPlaceholder('a.js', '  \n')).toBe(true);
    expect(isEmptyOrPlaceholder('a.js', ' // Empty\n')).toBe(true);
    expect(isEmptyOrPlaceholder('a.html', '<!-- Empty -->')).toBe(true);
    expect(isEmptyOrPlaceholder('a.css', '/* Empty */')).toBe(true);
    expect(isEmptyOrPlaceholder('a.json', '{}')).toBe(true);
    expect(isEmptyOrPlaceholder('a.js', '// Empty\nconsole.log(1)')).toBe(false);
    expect(isEmptyOrPlaceholder('a.css', '// Empty')).toBe(false);
  });
});

describe('sortFileNames', () => {
  it('puts known files first, in order, then the rest alphabetically', () => {
    expect(sortFileNames(['z.js', 'index.html', 'a.css', 'main.js', 'preload.js', 'renderer.js', 'styles.css'])).toEqual([
      'main.js',
      'renderer.js',
      'index.html',
      'preload.js',
      'styles.css',
      'a.css',
      'z.js',
    ]);
  });
});

describe('validation', () => {
  it('checks single names', () => {
    expect(thrownReason(() => assertValidFileName(''))).toBe('empty-name');
    expect(thrownReason(() => assertValidFileName('a/b.js'))).toBe('path-separator');
    expect(thrownReason(() => assertValidFileName('a\\b.js'))).toBe('path-separator');
    expect(thrownReason(() => assertValidFileName('package.json'))).toBe('reserved-name');
    expect(thrownReason(() => assertValidFileName('package-lock.json'))).toBe('reserved-name');
    expect(thrownReason(() => assertValidFileName('notes.md'))).toBe('unsupported-extension');
    expect(thrownReason(() => assertValidFileName('C:x.js'))).toBe('invalid-character');
    expect(thrownReason(() => assertValidFileName('ok.js'))).toBeNull();
  });

  it('throws FiddleErrors with invalid-argument', () => {
    try {
      assertValidFileName('x.md');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(FiddleError);
      expect((error as FiddleError).code).toBe(ErrorCode.invalidArgument);
      expect((error as FiddleError).details).toEqual({ reason: 'unsupported-extension', name: 'x.md' });
    }
  });

  it('checks adds', () => {
    const existing = ['main.js', 'index.html'];
    expect(thrownReason(() => assertCanAddFile(existing, 'index.html'))).toBe('duplicate-name');
    expect(thrownReason(() => assertCanAddFile(existing, 'INDEX.html'))).toBe('duplicate-name');
    expect(thrownReason(() => assertCanAddFile(existing, 'main.mjs'))).toBe('second-main-entry');
    expect(thrownReason(() => assertCanAddFile(existing, 'package.json'))).toBe('reserved-name');
    expect(thrownReason(() => assertCanAddFile(existing, 'extra.js'))).toBeNull();
    expect(thrownReason(() => assertCanAddFile(['index.html'], 'main.cjs'))).toBeNull();
  });

  it('checks renames', () => {
    const existing = ['main.js', 'index.html', 'a.js'];
    expect(thrownReason(() => assertCanRenameFile(existing, 'main.js', 'main.mjs'))).toBeNull();
    expect(thrownReason(() => assertCanRenameFile(existing, 'a.js', 'A.js'))).toBeNull();
    expect(thrownReason(() => assertCanRenameFile(existing, 'main.js', 'app.js'))).toBe('no-main-entry');
    expect(thrownReason(() => assertCanRenameFile(existing, 'a.js', 'main.cjs'))).toBe('second-main-entry');
    expect(thrownReason(() => assertCanRenameFile(existing, 'a.js', 'index.html'))).toBe('duplicate-name');
    expect(thrownReason(() => assertCanRenameFile(existing, 'a.js', 'sub/a.js'))).toBe('path-separator');
    expect(thrownReason(() => assertCanRenameFile(existing, 'a.js', 'package.json'))).toBe('reserved-name');
    expect(thrownReason(() => assertCanRenameFile(existing, 'nope.js', 'b.js'))).toBe('file-not-found');
  });

  it('refuses to remove the main entry', () => {
    expect(thrownReason(() => assertCanRemoveFile(['main.mjs', 'a.js'], 'main.mjs'))).toBe('remove-main-entry');
    expect(thrownReason(() => assertCanRemoveFile(['main.mjs', 'a.js'], 'a.js'))).toBeNull();
    expect(thrownReason(() => assertCanRemoveFile(['main.mjs'], 'b.js'))).toBe('file-not-found');
  });

  it('needs exactly one main entry in a set', () => {
    expect(thrownReason(() => assertValidFileSet(['main.js', 'index.html']))).toBeNull();
    expect(thrownReason(() => assertValidFileSet(['index.html']))).toBe('no-main-entry');
    expect(thrownReason(() => assertValidFileSet(['main.js', 'main.mjs']))).toBe('second-main-entry');
    expect(thrownReason(() => assertValidFileSet(['main.js', 'a.js', 'A.JS']))).toBe('duplicate-name');
  });
});

describe('ensureMainEntry', () => {
  it('adds an empty main.js when there is no main entry', () => {
    const input = { 'index.html': '<p/>' };
    const result = ensureMainEntry(input);
    expect(result).toEqual({ 'index.html': '<p/>', 'main.js': '// Empty' });
    expect(isEmptyOrPlaceholder('main.js', result['main.js']!)).toBe(true);
    expect(input).toEqual({ 'index.html': '<p/>' });
  });

  it('keeps an existing main entry of any kind', () => {
    const input = { 'main.cjs': 'x' };
    expect(ensureMainEntry(input)).toBe(input);
  });
});
