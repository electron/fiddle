import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import * as asar from '@electron/asar';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Fiddle, FiddleFactory } from '../src/index.js';

describe('FiddleFactory', () => {
  let tmpdir: string;
  let fiddleDir: string;
  let fiddleFactory: FiddleFactory;

  beforeEach(async () => {
    tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'fiddle-core-'));
    fiddleDir = path.join(tmpdir, 'fiddles');
    fiddleFactory = new FiddleFactory(fiddleDir);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await fs.promises.rm(tmpdir, { recursive: true, force: true });
  });

  function fiddleFixture(name: string): string {
    return path.join(import.meta.dirname, 'fixtures', 'fiddles', name);
  }

  // Serve the gist from a local bare repo, so the test runs offline.
  // git's `url.<base>.insteadOf` redirects https://gist.github.com/ to it.
  function useLocalGist(gistId: string): void {
    const work = path.join(tmpdir, 'gist-work');
    const remotes = path.join(tmpdir, 'gist-remotes');
    fs.cpSync(fiddleFixture(gistId), work, { recursive: true });
    const git = (...args: string[]) =>
      execFileSync(
        'git',
        [
          '-c',
          'user.name=test',
          '-c',
          'user.email=test@example.com',
          '-c',
          'commit.gpgsign=false',
          ...args,
        ],
        { cwd: work, stdio: 'ignore' },
      );
    git('init', '-q', '-b', 'master');
    git('add', '.');
    git('commit', '-q', '-m', 'fixture');
    git('clone', '-q', '--bare', work, path.join(remotes, `${gistId}.git`));

    const n = Number(process.env.GIT_CONFIG_COUNT ?? 0);
    vi.stubEnv(`GIT_CONFIG_KEY_${n}`, `url.${pathToFileURL(remotes).href}/.insteadOf`);
    vi.stubEnv(`GIT_CONFIG_VALUE_${n}`, 'https://gist.github.com/');
    vi.stubEnv('GIT_CONFIG_COUNT', String(n + 1));
  }

  it.todo('uses the fiddle cache path if none is specified');

  describe('create()', () => {
    it('reads fiddles from local folders', async () => {
      const sourceDir = fiddleFixture('642fa8daaebea6044c9079e3f8a46390');
      const fiddle = await fiddleFactory.create(sourceDir);
      expect(fiddle).toBeTruthy();

      // test that the fiddle is a copy of the original
      const dirname = path.dirname(fiddle!.mainPath);
      expect(dirname).not.toEqual(sourceDir);

      // test that main.js file is created (not app.asar)
      expect(path.basename(fiddle!.mainPath)).toBe('main.js');

      // test that the fiddle is kept in the fiddle cache
      expect(path.dirname(dirname)).toBe(fiddleDir);

      // test that the file list is identical
      const sourceFiles = fs.readdirSync(sourceDir);
      const fiddleFiles = fs.readdirSync(dirname);
      expect(fiddleFiles).toStrictEqual(sourceFiles);

      // test that the files' contents are identical
      for (const file of fiddleFiles) {
        const sourceFile = path.join(sourceDir, file);
        const fiddleFile = path.join(dirname, file);
        expect(fs.readFileSync(fiddleFile)).toStrictEqual(fs.readFileSync(sourceFile));
      }
    });

    it('reads fiddles from entries', async () => {
      const id = 'main.js';
      const content = '"use strict";';
      const files = new Map([[id, content]]);
      const fiddle = await fiddleFactory.create(files.entries());
      expect(fiddle).toBeTruthy();

      // test that the fiddle is kept in the fiddle cache
      const dirname = path.dirname(fiddle!.mainPath);
      expect(path.dirname(dirname)).toBe(fiddleDir);

      // test that the file list is identical
      const sourceFiles = [...files.keys()];
      const fiddleFiles = fs.readdirSync(dirname);
      expect(fiddleFiles).toEqual(sourceFiles);

      // test that the files' contents are identical
      for (const file of fiddleFiles) {
        const source = files.get(file);
        const fiddleFile = path.join(dirname, file);
        const target = fs.readFileSync(fiddleFile, 'utf8');
        expect(target).toEqual(source);
      }
    });

    it('rejects entries with filenames that escape the fiddle directory', async () => {
      const files: [string, string][] = [
        ['main.js', '"use strict";'],
        [path.join('..', '..', 'escaped.txt'), 'pwned'],
      ];
      await expect(fiddleFactory.create(files)).rejects.toThrow(/outside of fiddle/);
      expect(fs.existsSync(path.join(tmpdir, 'escaped.txt'))).toBe(false);
    });

    it('reads fiddles from gists', async () => {
      const gistId = '642fa8daaebea6044c9079e3f8a46390';
      useLocalGist(gistId);
      const fiddle = await fiddleFactory.create(gistId);
      expect(fiddle).toBeTruthy();
      expect(fs.existsSync(fiddle!.mainPath)).toBe(true);
      expect(path.basename(fiddle!.mainPath)).toBe('main.js');
      expect(path.dirname(path.dirname(fiddle!.mainPath))).toBe(fiddleDir);
    });

    it('acts as a pass-through when given a fiddle', async () => {
      const fiddleIn = new Fiddle('/main/path', 'source');
      const fiddle = await fiddleFactory.create(fiddleIn);
      expect(fiddle).toBe(fiddleIn);
    });

    it('packages fiddle into ASAR archive', async () => {
      const sourceDir = fiddleFixture('642fa8daaebea6044c9079e3f8a46390');
      const fiddle = await fiddleFactory.create(sourceDir, {
        packAsAsar: true,
      });

      function normalizeAsarFiles(files: string[]): string[] {
        return files.map(
          (f) => f.replace(/^[\\/]/, ''), // Remove leading slash or backslash
        );
      }

      // test that app.asar file is created
      expect(fiddle).toBeTruthy();
      expect(path.basename(fiddle!.mainPath)).toBe('app.asar');

      // test that the file list is identical
      const dirname: string = fiddle!.mainPath;
      const sourceFiles = fs.readdirSync(sourceDir);
      const asarFiles = normalizeAsarFiles(asar.listPackage(dirname, { isPack: false }));
      expect(asarFiles).toStrictEqual(sourceFiles);

      // test that the files' contents are identical
      for (const file of sourceFiles) {
        const sourceFileContent = fs.readFileSync(path.join(sourceDir, file), 'utf-8');
        const asarFileContent = asar.extractFile(dirname, file).toString();
        expect(asarFileContent).toStrictEqual(sourceFileContent);
      }
    });

    it.todo('reads fiddles from git repositories');
    it.todo('refreshes the cache if given a previously-cached git repository');

    it('returns undefined for unknown input', async () => {
      const fiddle = await fiddleFactory.create('fnord');
      expect(fiddle).toBeUndefined();
    });
  });
});

describe('Fiddle', () => {
  describe('remove()', () => {
    it.todo('removes the fiddle');
  });
});
