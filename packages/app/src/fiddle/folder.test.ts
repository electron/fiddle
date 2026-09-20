import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorCode } from '../shared/errors';
import {
  findFilesToReplace,
  GITIGNORE_CONTENT,
  localPathFromFileUrl,
  readFiddleFolder,
  writeFiddleFolder,
} from './folder';

const renameMock = vi.hoisted(() => ({ fail: [] as string[] }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  // core's retry loop calls the default export's `rename`.
  const rename = async (from: string, to: string) => {
    const code = renameMock.fail.shift();
    if (code) throw Object.assign(new Error(code), { code });
    return actual.rename(from, to);
  };
  return { ...actual, rename, default: { ...actual, rename } };
});

// The retry loop's sleeps move the fake clock, so its time limit is reached at once.
vi.mock('node:timers/promises', () => ({
  setTimeout: async (ms: number) => {
    vi.advanceTimersByTime(ms);
  },
}));

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'fiddle-folder-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function put(files: Record<string, string>, into = dir) {
  for (const [name, content] of Object.entries(files))
    await writeFile(path.join(into, name), content);
}

describe('readFiddleFolder', () => {
  it('reads supported top-level files and package.json, never symlinks', async () => {
    await put({
      'main.js': 'main',
      'Index.HTML': '<p/>',
      'README.md': 'no',
      'package.json': JSON.stringify({
        dependencies: { lodash: '4.17.21' },
        devDependencies: { electron: '^30.0.0' },
      }),
      'package-lock.json': '{}',
    });
    await mkdir(path.join(dir, 'sub'));
    await writeFile(path.join(dir, 'sub', 'nested.js'), 'nested');
    await mkdir(path.join(dir, 'looks-like.js'));
    if (process.platform !== 'win32')
      await symlink(path.join(dir, 'main.js'), path.join(dir, 'link.js'));

    const result = await readFiddleFolder(dir);
    expect(result.files).toEqual({ 'main.js': 'main', 'Index.HTML': '<p/>' });
    expect(result.packageJson).toEqual({
      modules: { lodash: '4.17.21' },
      rejectedModules: [],
      electronVersion: '30.0.0',
    });
    expect(result.modules).toEqual({ lodash: '4.17.21' });
    expect(result.packageJsonError).toBeUndefined();
    expect(result.skipped.sort()).toEqual(['README.md', 'package-lock.json']);
    expect(result.unknown).toEqual(['Index.HTML']);
  });

  it('still loads the folder when package.json is invalid', async () => {
    await put({ 'main.js': 'main', 'package.json': '{ nope' });
    const result = await readFiddleFolder(dir);
    expect(result.files).toEqual({ 'main.js': 'main' });
    expect(result.packageJson).toBeUndefined();
    expect(result.packageJsonError).toMatchObject({
      code: ErrorCode.invalidArgument,
      details: { reason: 'invalid-json' },
    });
  });

  it('adds a main entry when there is none', async () => {
    await put({ 'index.html': '<p/>' });
    expect((await readFiddleFolder(dir)).files).toEqual({
      'index.html': '<p/>',
      'main.js': '// Empty',
    });
  });

  it('refuses a folder without supported files', async () => {
    await put({ 'README.md': 'x', 'package.json': '{}' });
    await expect(readFiddleFolder(dir)).rejects.toMatchObject({
      details: { reason: 'no-supported-files' },
    });
  });

  it('reports a missing folder as not-found', async () => {
    await expect(readFiddleFolder(path.join(dir, 'missing'))).rejects.toMatchObject({
      code: ErrorCode.notFound,
    });
  });
});

describe('writeFiddleFolder', () => {
  it('writes files, deletes empty ones, and writes .gitignore', async () => {
    await put({ 'old.css': 'stale', 'keep.txt': 'untouched' });
    const target = path.join(dir, 'new', 'project');
    await mkdir(target, { recursive: true });
    await writeFile(path.join(target, 'old.css'), 'stale');

    await writeFiddleFolder(target, {
      'main.js': 'main',
      'old.css': '',
      'gone.js': '',
      'package.json': '{}',
    });

    expect((await readdir(target)).sort()).toEqual([
      '.gitignore',
      'main.js',
      'package.json',
    ]);
    expect(await readFile(path.join(target, '.gitignore'), 'utf8')).toBe(
      GITIGNORE_CONTENT,
    );
    expect(GITIGNORE_CONTENT).toBe('node_modules\nout');
    expect(await readFile(path.join(target, 'main.js'), 'utf8')).toBe('main');
  });

  it('deletes the files it is told the fiddle no longer has, and leaves other files alone', async () => {
    await put({
      'main.js': 'old',
      'renderer.js': 'gone',
      'a.js': 'old',
      'notes.md': 'mine',
    });
    await writeFiddleFolder(dir, { 'main.js': 'new', 'b.js': 'renamed' }, [
      'renderer.js',
      'a.js',
      'missing.js',
    ]);
    expect((await readdir(dir)).sort()).toEqual([
      '.gitignore',
      'b.js',
      'main.js',
      'notes.md',
    ]);
  });

  it('deletes only after everything is written, so a failed write leaves the old files', async () => {
    await put({ 'a.js': 'old', 'empty.js': 'old' });
    try {
      renameMock.fail = ['EIO'];
      await expect(
        writeFiddleFolder(dir, { 'main.js': 'new', 'empty.js': '' }, ['a.js']),
      ).rejects.toMatchObject({ code: 'EIO' });
    } finally {
      renameMock.fail = [];
    }
    expect((await readdir(dir)).sort()).toEqual(['a.js', 'empty.js']);
  });

  it('writes empty files when asked to, for a run', async () => {
    await writeFiddleFolder(dir, { 'main.js': 'x', 'preload.js': '' }, [], {
      keepEmpty: true,
    });
    expect(await readFile(path.join(dir, 'preload.js'), 'utf8')).toBe('');
  });

  it('ends a case-only rename with the new name', async () => {
    await put({ 'main.js': 'old' });
    await writeFiddleFolder(dir, { 'Main.js': 'new' }, ['main.js']);
    expect((await readdir(dir)).sort()).toEqual(['.gitignore', 'Main.js']);
    expect(await readFile(path.join(dir, 'Main.js'), 'utf8')).toBe('new');
  });

  it('checks the names to remove too, so nothing outside the folder is deleted', async () => {
    const outside = path.join(dir, 'outside.js');
    await writeFile(outside, 'keep');
    const inner = path.join(dir, 'inner');
    await expect(
      writeFiddleFolder(inner, { 'main.js': 'x' }, ['../outside.js']),
    ).rejects.toMatchObject({
      details: { reason: 'path-separator' },
    });
    expect(await readFile(outside, 'utf8')).toBe('keep');
  });

  it('retries a rename that Windows refuses while another process holds the file', async () => {
    const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      renameMock.fail = ['EBUSY', 'EPERM'];
      await writeFiddleFolder(dir, { 'main.js': 'x' });
      expect(await readFile(path.join(dir, 'main.js'), 'utf8')).toBe('x');
      renameMock.fail = Array<string>(100).fill('EBUSY');
      await expect(writeFiddleFolder(dir, { 'main.js': 'y' })).rejects.toMatchObject({
        code: 'EBUSY',
      });
      expect((await readdir(dir)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
    } finally {
      vi.useRealTimers();
      Object.defineProperty(process, 'platform', platform);
      renameMock.fail = [];
    }
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
    await expect(
      writeFiddleFolder(dir, { 'main.js': 'x', [name]: 'bad' }),
    ).rejects.toMatchObject({
      code: ErrorCode.invalidArgument,
      details: { reason },
    });
    expect(await readdir(dir)).toEqual([]);
  });

  it('refuses names that differ only in case, which would overwrite each other', async () => {
    await expect(
      writeFiddleFolder(dir, { 'Main.js': 'mine', 'main.js': '// Empty' }),
    ).rejects.toMatchObject({
      details: { reason: 'duplicate-name', name: 'main.js' },
    });
    expect(await readdir(dir)).toEqual([]);
  });

  it.skipIf(process.platform === 'win32')(
    'replaces symlinks instead of following them out of the folder',
    async () => {
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
        expect(await readFile(path.join(dir, '.gitignore'), 'utf8')).toBe(
          GITIGNORE_CONTENT,
        );
      } finally {
        await rm(outside, { recursive: true, force: true });
      }
    },
  );
});

describe('findFilesToReplace', () => {
  it('lists every file a save replaces or deletes, .gitignore included, ignoring case', async () => {
    await put({
      'Main.js': 'x',
      'gone.js': 'x',
      '.gitignore': 'x',
      'notes.md': 'x',
      'keep.js': 'x',
    });
    const files = { 'main.js': 'new', 'gone.js': '', 'package.json': '{}' };
    expect((await findFilesToReplace(dir, files)).sort()).toEqual([
      '.gitignore',
      'Main.js',
      'gone.js',
    ]);
  });

  it('refuses Windows device names before writing anything', async () => {
    await expect(
      writeFiddleFolder(dir, { 'main.js': 'x', 'con.js': 'bad' }),
    ).rejects.toMatchObject({
      details: { reason: 'reserved-name', name: 'con.js' },
    });
    expect(await readdir(dir)).toEqual([]);
  });

  it('is empty for a missing folder', async () => {
    expect(
      await findFilesToReplace(path.join(dir, 'missing'), { 'main.js': 'x' }),
    ).toEqual([]);
  });
});

describe('localPathFromFileUrl', () => {
  it('turns local file URLs into paths', () => {
    expect(localPathFromFileUrl('file:///home/me/fiddle', 'linux')).toBe(
      '/home/me/fiddle',
    );
    expect(localPathFromFileUrl('file://localhost/home/me/fiddle', 'linux')).toBe(
      '/home/me/fiddle',
    );
    expect(localPathFromFileUrl('file:///C:/Users/me/fiddle', 'win32')).toBe(
      'C:\\Users\\me\\fiddle',
    );
  });

  it.each([
    'file://server/share/fiddle',
    'file:////server/share/fiddle',
    'file://192.168.0.1/share/fiddle',
    'https://example.com/fiddle',
    'not a url',
  ])('refuses %j, which could reach another machine', (url) => {
    expect(localPathFromFileUrl(url, 'win32')).toBeUndefined();
    expect(localPathFromFileUrl(url, 'linux')).toBeUndefined();
  });
});
