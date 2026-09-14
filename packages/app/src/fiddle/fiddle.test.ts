import { describe, expect, it } from 'vitest';

import { ErrorCode, FiddleError } from '../shared/errors';
import {
  addFile,
  checkEsmSupport,
  createFiddle,
  type Fiddle,
  fileNames,
  hideFile,
  removeFile,
  renameFile,
  sameFiles,
  setFileContent,
  showFile,
  VersionRefSchema,
  visibleFileNames,
} from './fiddle';
import { thrownReason } from './test-helpers/errors';

const version = { kind: 'release', version: '30.0.0' } as const;

function base(): Fiddle {
  return createFiddle({
    files: { 'main.js': 'app()', 'index.html': '<p/>', 'styles.css': '/* Empty */', 'renderer.js': '' },
    version,
  });
}

describe('checkEsmSupport', () => {
  const mjs = { 'main.mjs': 'import { app } from "electron";' };

  // @feature run.check-esm
  it('refuses a main.mjs entry before Electron 28', () => {
    expect(checkEsmSupport(mjs, { kind: 'release', version: '27.3.0' })).toMatchObject({
      code: ErrorCode.invalidArgument,
      details: { reason: 'esm-unsupported', file: 'main.mjs', version: '27.3.0' },
    });
    expect(checkEsmSupport({ 'Main.MJS': '' }, { kind: 'release', version: '22.0.0' })).toBeInstanceOf(FiddleError);
  });

  // @feature run.check-esm
  it('allows Electron 28 and later, local builds, and CommonJS entries', () => {
    expect(checkEsmSupport(mjs, { kind: 'release', version: '28.0.0' })).toBeNull();
    expect(checkEsmSupport(mjs, { kind: 'release', version: '28.0.0-alpha.1' })).toBeNull();
    expect(checkEsmSupport(mjs, { kind: 'release', version: '33.0.0-nightly.20240801' })).toBeNull();
    expect(checkEsmSupport(mjs, { kind: 'local', id: 'my-build' })).toBeNull();
    expect(checkEsmSupport({ 'main.js': '', 'preload.mjs': '' }, { kind: 'release', version: '20.0.0' })).toBeNull();
  });
});

describe('createFiddle', () => {
  // @feature files.placeholder
  it('hides empty and placeholder-only files and fills defaults', () => {
    const fiddle = base();
    expect(fiddle.hidden).toEqual(['renderer.js', 'styles.css']);
    expect(visibleFileNames(fiddle)).toEqual(['main.js', 'index.html']);
    expect(fiddle.origin).toEqual({ kind: 'local' });
    expect(fiddle.modules).toEqual({});
    expect(fiddle.source).toEqual({});
    expect(fiddle.templateName).toBeUndefined();
  });

  // @feature files.add-main
  it('adds a hidden main.js when there is no main entry', () => {
    const fiddle = createFiddle({ files: { 'index.html': 'x' }, version, templateName: 'App' });
    expect(fileNames(fiddle)).toEqual(['main.js', 'index.html']);
    expect(fiddle.hidden).toEqual(['main.js']);
    expect(fiddle.templateName).toBe('App');
  });
});

describe('file operations', () => {
  // @feature files.operations files.placeholder
  it('adds a visible file with its placeholder', () => {
    const fiddle = addFile(base(), 'extra.css');
    expect(fiddle.files['extra.css']).toBe('/* Empty */');
    expect(visibleFileNames(fiddle)).toContain('extra.css');
    expect(addFile(base(), 'a.js', 'x').files['a.js']).toBe('x');
  });

  // @feature files.no-duplicates files.reserved-names files.one-main files.extensions
  it('validates adds', () => {
    expect(thrownReason(() => addFile(base(), 'index.html'))).toBe('duplicate-name');
    expect(thrownReason(() => addFile(base(), 'main.mjs'))).toBe('second-main-entry');
    expect(thrownReason(() => addFile(base(), 'package.json'))).toBe('reserved-name');
    expect(thrownReason(() => addFile(base(), 'x.txt'))).toBe('unsupported-extension');
  });

  // @feature files.operations
  it('renames, keeping content and visibility', () => {
    const fiddle = renameFile(renameFile(base(), 'styles.css', 'app.css'), 'main.js', 'main.mjs');
    expect(fiddle.files['app.css']).toBe('/* Empty */');
    expect(fiddle.files['main.mjs']).toBe('app()');
    expect(fiddle.files['main.js']).toBeUndefined();
    expect(fiddle.hidden).toContain('app.css');
    expect(thrownReason(() => renameFile(base(), 'main.js', 'app.js'))).toBe('no-main-entry');
  });

  // @feature files.operations files.main-undeletable
  it('removes files but never the main entry', () => {
    const fiddle = removeFile(base(), 'styles.css');
    expect(fiddle.files['styles.css']).toBeUndefined();
    expect(fiddle.hidden).not.toContain('styles.css');
    expect(thrownReason(() => removeFile(base(), 'main.js'))).toBe('remove-main-entry');
  });

  // @feature files.operations
  it('hides and shows files, keeping content', () => {
    const hidden = hideFile(base(), 'index.html');
    expect(hidden.hidden).toContain('index.html');
    expect(hidden.files['index.html']).toBe('<p/>');
    expect(hideFile(hidden, 'index.html')).toBe(hidden);
    expect(showFile(hidden, 'index.html').hidden).not.toContain('index.html');
    expect(() => hideFile(base(), 'nope.js')).toThrow(FiddleError);
    try {
      showFile(base(), 'nope.js');
    } catch (error) {
      expect((error as FiddleError).code).toBe(ErrorCode.notFound);
    }
  });

  it('sets content only on existing files', () => {
    expect(setFileContent(base(), 'main.js', 'y').files['main.js']).toBe('y');
    expect(() => setFileContent(base(), 'new.js', 'y')).toThrow(FiddleError);
  });

  it('never mutates its input', () => {
    const fiddle = base();
    const snapshot = structuredClone(fiddle);
    addFile(fiddle, 'b.js');
    renameFile(fiddle, 'index.html', 'page.html');
    removeFile(fiddle, 'index.html');
    hideFile(fiddle, 'main.js');
    expect(fiddle).toEqual(snapshot);
  });
});

describe('sameFiles', () => {
  it('compares names and content', () => {
    expect(sameFiles({ a: '1', b: '2' }, { b: '2', a: '1' })).toBe(true);
    expect(sameFiles({ a: '1' }, { a: '2' })).toBe(false);
    expect(sameFiles({ a: '1' }, { a: '1', b: '' })).toBe(false);
    expect(sameFiles({ a: '1', c: '' }, { a: '1', b: '' })).toBe(false);
  });
});

describe('VersionRefSchema', () => {
  it('parses both kinds', () => {
    expect(VersionRefSchema.parse({ kind: 'release', version: '1.0.0' })).toEqual({ kind: 'release', version: '1.0.0' });
    expect(VersionRefSchema.parse({ kind: 'local', id: 'abc' })).toEqual({ kind: 'local', id: 'abc' });
    expect(VersionRefSchema.safeParse({ kind: 'other' }).success).toBe(false);
  });
});
