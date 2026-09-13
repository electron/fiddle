import { lstat, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ErrorCode } from '../shared/errors';
import { findExistingSupportedFiles, GITIGNORE_CONTENT, readFiddleFolder, writeFiddleFolder } from './folder';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'fiddle-folder-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function put(files: Record<string, string>, into = dir) {
  for (const [name, content] of Object.entries(files)) await writeFile(path.join(into, name), content);
}

describe('readFiddleFolder', () => {
  it('reads supported top-level files and package.json, never symlinks', async () => {
    await put({
      'main.js': 'main',
      'Index.HTML': '<p/>',
      'README.md': 'no',
      'package.json': JSON.stringify({ dependencies: { lodash: '4.17.21' }, devDependencies: { electron: '^30.0.0' } }),
      'package-lock.json': '{}',
    });
    await mkdir(path.join(dir, 'sub'));
    await writeFile(path.join(dir, 'sub', 'nested.js'), 'nested');
    await mkdir(path.join(dir, 'looks-like.js'));
    await symlink(path.join(dir, 'main.js'), path.join(dir, 'link.js'));

    const result = await readFiddleFolder(dir);
    expect(result.files).toEqual({ 'main.js': 'main', 'Index.HTML': '<p/>' });
    expect(result.packageJson).toEqual({ modules: { lodash: '4.17.21' }, rejectedModules: [], electronVersion: '30.0.0' });
    expect(result.modules).toEqual({ lodash: '4.17.21' });
    expect(result.packageJsonError).toBeUndefined();
    expect(result.skipped.sort()).toEqual(['README.md', 'package-lock.json']);
    expect(result.unknown).toEqual(['Index.HTML']);
  });

  it('still loads the folder when package.json is invalid, keeping the previous modules', async () => {
    await put({ 'main.js': 'main', 'package.json': '{ nope' });
    const result = await readFiddleFolder(dir, { previousModules: { old: '1.0.0' } });
    expect(result.files).toEqual({ 'main.js': 'main' });
    expect(result.packageJson).toBeUndefined();
    expect(result.modules).toEqual({ old: '1.0.0' });
    expect(result.packageJsonError).toMatchObject({ code: ErrorCode.invalidArgument, details: { reason: 'invalid-json' } });
  });

  it('adds a main entry when there is none', async () => {
    await put({ 'index.html': '<p/>' });
    expect((await readFiddleFolder(dir)).files).toEqual({ 'index.html': '<p/>', 'main.js': '// Empty' });
  });

  it('refuses a folder without supported files', async () => {
    await put({ 'README.md': 'x', 'package.json': '{}' });
    await expect(readFiddleFolder(dir)).rejects.toMatchObject({ details: { reason: 'no-supported-files' } });
  });

  it('reports a missing folder as not-found', async () => {
    await expect(readFiddleFolder(path.join(dir, 'missing'))).rejects.toMatchObject({ code: ErrorCode.notFound });
  });
});

describe('writeFiddleFolder', () => {
  it('writes files, deletes empty ones, and writes .gitignore', async () => {
    await put({ 'old.css': 'stale', 'keep.txt': 'untouched' });
    const target = path.join(dir, 'new', 'project');
    await mkdir(target, { recursive: true });
    await writeFile(path.join(target, 'old.css'), 'stale');

    await writeFiddleFolder(target, { 'main.js': 'main', 'old.css': '', 'gone.js': '', 'package.json': '{}' });

    expect((await readdir(target)).sort()).toEqual(['.gitignore', 'main.js', 'package.json']);
    expect(await readFile(path.join(target, '.gitignore'), 'utf8')).toBe(GITIGNORE_CONTENT);
    expect(GITIGNORE_CONTENT).toBe('node_modules\nout');
    expect(await readFile(path.join(target, 'main.js'), 'utf8')).toBe('main');
  });

  it('creates the folder', async () => {
    const target = path.join(dir, 'a', 'b');
    await writeFiddleFolder(target, { 'main.js': 'x' });
    expect((await readdir(target)).sort()).toEqual(['.gitignore', 'main.js']);
  });

  it.each([
    ['../evil.js', 'path-separator'],
    ['sub/x.js', 'path-separator'],
    ['sub\\x.js', 'path-separator'],
    ['/etc/x.js', 'path-separator'],
    ['..', 'unsupported-extension'],
    ['.', 'unsupported-extension'],
    ['.gitignore', 'unsupported-extension'],
    ['notes.md', 'unsupported-extension'],
    ['C:x.js', 'invalid-character'],
    ['a\0.js', 'invalid-character'],
    ['', 'empty-name'],
  ])('refuses %j (%s) before writing anything', async (name, reason) => {
    await expect(writeFiddleFolder(dir, { 'main.js': 'x', [name]: 'bad' })).rejects.toMatchObject({
      code: ErrorCode.invalidArgument,
      details: { reason },
    });
    expect(await readdir(dir)).toEqual([]);
  });

  it('refuses names that differ only in case, which would overwrite each other', async () => {
    await expect(writeFiddleFolder(dir, { 'Main.js': 'mine', 'main.js': '// Empty' })).rejects.toMatchObject({
      details: { reason: 'duplicate-name', name: 'main.js' },
    });
    expect(await readdir(dir)).toEqual([]);
  });

  it('replaces symlinks instead of following them out of the folder', async () => {
    const outside = await mkdtemp(path.join(tmpdir(), 'fiddle-outside-'));
    try {
      await put({ 'secret.js': 'secret', ignore: 'ignore' }, outside);
      await symlink(path.join(outside, 'secret.js'), path.join(dir, 'main.js'));
      await symlink(path.join(outside, 'secret.js'), path.join(dir, 'gone.js'));
      await symlink(path.join(outside, 'ignore'), path.join(dir, '.gitignore'));

      await writeFiddleFolder(dir, { 'main.js': 'new', 'gone.js': '' });

      expect(await readFile(path.join(outside, 'secret.js'), 'utf8')).toBe('secret');
      expect(await readFile(path.join(outside, 'ignore'), 'utf8')).toBe('ignore');
      expect((await readdir(outside)).sort()).toEqual(['ignore', 'secret.js']);
      expect((await readdir(dir)).sort()).toEqual(['.gitignore', 'main.js']);
      expect((await lstat(path.join(dir, 'main.js'))).isSymbolicLink()).toBe(false);
      expect(await readFile(path.join(dir, 'main.js'), 'utf8')).toBe('new');
      expect(await readFile(path.join(dir, '.gitignore'), 'utf8')).toBe(GITIGNORE_CONTENT);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
});

describe('findExistingSupportedFiles', () => {
  it('lists supported files so the user can be warned', async () => {
    await put({ 'main.js': 'x', 'package.json': '{}', 'notes.md': 'x' });
    expect((await findExistingSupportedFiles(dir)).sort()).toEqual(['main.js', 'package.json']);
  });

  it('is empty for a missing or unrelated folder', async () => {
    expect(await findExistingSupportedFiles(path.join(dir, 'missing'))).toEqual([]);
    await put({ 'notes.md': 'x' });
    expect(await findExistingSupportedFiles(dir)).toEqual([]);
  });
});
