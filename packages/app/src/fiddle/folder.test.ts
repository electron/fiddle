import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ErrorCode } from '../shared/errors';
import { assertSafeFileName, findExistingSupportedFiles, GITIGNORE_CONTENT, readFiddleFolder, writeFiddleFolder } from './folder';
import { thrownReason } from './test-helpers/zip';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'fiddle-folder-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function put(files: Record<string, string>) {
  for (const [name, content] of Object.entries(files)) await writeFile(path.join(dir, name), content);
}

describe('readFiddleFolder', () => {
  it('reads supported top-level files and package.json', async () => {
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
    expect(result.packageJsonError).toBeUndefined();
  });

  it('still loads the folder when package.json is invalid', async () => {
    await put({ 'main.js': 'main', 'package.json': '{ nope' });
    const result = await readFiddleFolder(dir);
    expect(result.files).toEqual({ 'main.js': 'main' });
    expect(result.packageJson).toBeUndefined();
    expect(result.packageJsonError).toMatchObject({ code: ErrorCode.invalidArgument, details: { reason: 'invalid-json' } });
  });

  it('adds a main entry when there is none', async () => {
    await put({ 'index.html': '<p/>' });
    expect((await readFiddleFolder(dir)).files).toEqual({ 'index.html': '<p/>', 'main.js': '// Empty' });
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

  it('rejects path traversal before writing anything', async () => {
    for (const name of ['../evil.js', '..', '.', 'sub/x.js', 'sub\\x.js', '/etc/x.js', 'C:x.js', '']) {
      await expect(writeFiddleFolder(dir, { 'main.js': 'x', [name]: 'bad' })).rejects.toMatchObject({
        details: { reason: 'unsafe-path' },
      });
    }
    expect(await readdir(dir)).toEqual([]);
    expect(thrownReason(() => assertSafeFileName('fine.js'))).toBeNull();
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
