import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFiddle } from '../../fiddle/fiddle';
import type { GistLoadResult } from '../../fiddle/github';
import type { TemplateLoader } from '../../fiddle/templates';
import { gistOrigin } from '../../fiddle/trust';
import {
  fiddleFromGist,
  filesForSave,
  gistDependencies,
  loadFolder,
  newFiddle,
  saveToFolder,
} from './load';

const current = {
  version: { kind: 'release', version: '30.0.0' } as const,
  modules: { lodash: '^4.0.0' },
};

function gist(files: Record<string, string>): GistLoadResult {
  return {
    id: 'a'.repeat(32),
    owner: 'octocat',
    description: 'demo',
    public: true,
    url: 'https://gist.github.com/aaaa',
    revision: 'b'.repeat(40),
    files,
    origin: gistOrigin('a'.repeat(32), 'b'.repeat(40), 'octocat'),
  };
}

describe('fiddleFromGist', () => {
  it('skips unsupported files and asks before adding unknown ones', async () => {
    const confirmAddFile = vi.fn(async (name: string) => name === 'keep.js');
    const loaded = await fiddleFromGist(
      gist({
        'main.js': 'm',
        'README.md': '#',
        'keep.js': 'k',
        'drop.css': 'd',
        'package-lock.json': '{}',
      }),
      { context: current, confirmAddFile },
    );
    expect(Object.keys(loaded.fiddle.files).sort()).toEqual(['keep.js', 'main.js']);
    expect(confirmAddFile.mock.calls.map(([name]) => name).sort()).toEqual([
      'drop.css',
      'keep.js',
    ]);
    expect(loaded.fiddle.origin).toEqual({
      kind: 'gist',
      owner: 'octocat',
      id: 'a'.repeat(32),
      sha: 'b'.repeat(40),
    });
    expect(loaded.fiddle.source).toEqual({
      gistId: 'a'.repeat(32),
      gistRevision: 'b'.repeat(40),
    });
    expect(loaded.gistOwner).toBe('octocat');
  });

  it('errors when the gist has no supported files', async () => {
    await expect(
      fiddleFromGist(gist({ 'README.md': '#', 'package.json': '{}' }), {
        context: current,
        confirmAddFile: async () => true,
      }),
    ).rejects.toMatchObject({ details: { reason: 'no-supported-files' } });
  });

  it('adds a main entry when the gist has none', async () => {
    const loaded = await fiddleFromGist(gist({ 'index.html': '<p>' }), {
      context: current,
      confirmAddFile: async () => true,
    });
    expect(Object.keys(loaded.fiddle.files)).toContain('main.js');
  });

  it('takes modules and the Electron version from package.json', async () => {
    const pkg = JSON.stringify({
      dependencies: { react: '^19.0.0' },
      devDependencies: { electron: '^31.1.0' },
    });
    const loaded = await fiddleFromGist(gist({ 'main.js': '', 'package.json': pkg }), {
      context: current,
      confirmAddFile: async () => true,
    });
    expect(loaded.fiddle.modules).toEqual({ react: '^19.0.0' });
    expect(loaded.fiddle.version).toEqual({ kind: 'release', version: '31.1.0' });
    expect(loaded.warnings).toEqual([]);
  });

  it('has no modules without a package.json, and keeps the current version', async () => {
    const loaded = await fiddleFromGist(gist({ 'main.js': '' }), {
      context: current,
      confirmAddFile: async () => true,
    });
    expect(loaded.fiddle.modules).toEqual({});
    expect(loaded.fiddle.version).toEqual(current.version);
    expect(loaded.warnings).toEqual([]);
  });

  it('keeps the current version with a warning when package.json asks for an unusable one', async () => {
    const pkg = JSON.stringify({ devDependencies: { electron: '99.0.0' } });
    const loaded = await fiddleFromGist(gist({ 'main.js': '', 'package.json': pkg }), {
      context: current,
      confirmAddFile: async () => true,
      isUsableVersion: () => false,
    });
    expect(loaded.fiddle.version).toEqual(current.version);
    expect(loaded.warnings).toEqual([{ kind: 'unusable-version', version: '99.0.0' }]);
  });

  it('keeps the current version with a warning when package.json names an Electron version that is not one, and drops module specs it will not install', async () => {
    const pkg = JSON.stringify({
      dependencies: { react: '^19.0.0', evil: 'git+https://x.test/y' },
      devDependencies: { electron: 'latest' },
    });
    const loaded = await fiddleFromGist(gist({ 'main.js': '', 'package.json': pkg }), {
      context: current,
      confirmAddFile: async () => true,
    });
    expect(loaded.fiddle.version).toEqual(current.version);
    expect(loaded.fiddle.modules).toEqual({ react: '^19.0.0' });
    expect(loaded.warnings).toEqual([
      { kind: 'unusable-version', version: 'latest' },
      {
        kind: 'rejected-modules',
        modules: [{ name: 'evil', spec: 'git+https://x.test/y', reason: 'invalid-spec' }],
      },
    ]);
  });

  it('warns about an invalid package.json and keeps the previous modules', async () => {
    const loaded = await fiddleFromGist(
      gist({ 'main.js': '', 'package.json': '{nope' }),
      {
        context: current,
        confirmAddFile: async () => true,
      },
    );
    expect(loaded.warnings).toEqual([{ kind: 'invalid-package-json' }]);
    expect(loaded.fiddle.modules).toEqual(current.modules);
  });
});

describe('gistDependencies', () => {
  it('lists the modules of the gist’s package.json, and none when it is missing or invalid', () => {
    expect(
      gistDependencies(
        gist({ 'package.json': JSON.stringify({ dependencies: { lodash: '4.17.21' } }) }),
      ),
    ).toEqual({
      lodash: '4.17.21',
    });
    expect(gistDependencies(gist({ 'main.js': '' }))).toEqual({});
    expect(gistDependencies(gist({ 'package.json': '{nope' }))).toEqual({});
  });
});

describe('folders', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'my-fiddle-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('loads a folder and names the project after it', async () => {
    await writeFile(path.join(dir, 'main.js'), 'm');
    await writeFile(path.join(dir, 'package.json'), '{bad');
    const loaded = await loadFolder(dir, current);
    expect(loaded.fiddle.files).toEqual({ 'main.js': 'm' });
    expect(loaded.fiddle.source).toEqual({ localPath: dir });
    expect(loaded.name).toBe(path.basename(dir));
    expect(loaded.warnings).toEqual([{ kind: 'invalid-package-json' }]);
    expect(loaded.fiddle.modules).toEqual(current.modules);
    expect(loaded.fiddle.version).toEqual(current.version);
  });

  it('has no modules when the folder has no package.json', async () => {
    await writeFile(path.join(dir, 'main.js'), 'm');
    const loaded = await loadFolder(dir, current);
    expect(loaded.fiddle.modules).toEqual({});
    expect(loaded.fiddle.version).toEqual(current.version);
    expect(loaded.warnings).toEqual([]);
  });

  it('saves the files with a generated package.json and .gitignore', async () => {
    const fiddle = createFiddle({
      files: { 'main.js': 'm', 'styles.css': '' },
      version: current.version,
      modules: { a: '1.0.0' },
    });
    await saveToFolder(dir, fiddle, { name: 'demo', author: 'me' });
    const pkg = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
    expect(pkg).toMatchObject({
      name: 'demo',
      main: './main.js',
      author: 'me',
      dependencies: { a: '1.0.0' },
    });
    expect(pkg.devDependencies).toEqual({ electron: '30.0.0' });
    expect(await readFile(path.join(dir, '.gitignore'), 'utf8')).toContain(
      'node_modules',
    );
  });

  it('writes a valid package name whatever the folder is called, and deletes the files it is told to', async () => {
    await writeFile(path.join(dir, 'old.js'), 'old');
    const fiddle = createFiddle({ files: { 'main.js': 'm' }, version: current.version });
    await saveToFolder(dir, fiddle, {
      name: 'My Fiddle',
      remove: ['old.js', 'never-existed.js'],
    });
    expect(
      JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8')),
    ).toMatchObject({ name: 'my-fiddle' });
    await expect(readFile(path.join(dir, 'old.js'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('adds Forge config for "Save as Forge project"', () => {
    const fiddle = createFiddle({ files: { 'main.js': 'm' }, version: current.version });
    const files = filesForSave(fiddle, {
      name: 'demo',
      forge: { forgeVersion: '^7.8.0' },
    });
    const pkg = JSON.parse(files['package.json']!);
    expect(pkg.scripts.make).toBe('electron-forge make');
    expect(pkg.devDependencies['@electron-forge/cli']).toBe('^7.8.0');
  });
});

describe('newFiddle', () => {
  it('uses the template for the version', async () => {
    const templates: TemplateLoader = {
      getTemplate: vi.fn(async () => ({ 'main.js': 'tpl' })),
      getTestTemplate: vi.fn(async () => ({ 'main.js': 'test' })),
      getQuickStart: vi.fn(async () => ({ 'main.js': 'qs' })),
    };
    const loaded = await newFiddle(templates, { kind: 'release', version: '31.0.0' });
    expect(templates.getTemplate).toHaveBeenCalledWith('31.0.0', undefined);
    expect(loaded.fiddle.templateName).toBe('template');
    expect(loaded.fiddle.modules).toEqual({});
    const local = await newFiddle(templates, { kind: 'local', id: 'x' });
    expect(local.fiddle.files).toEqual({ 'main.js': 'tpl' });
    expect(templates.getTemplate).toHaveBeenLastCalledWith(undefined, undefined);
    await newFiddle(templates, { kind: 'release', version: '31.0.0' }, 10);
    expect(templates.getTemplate).toHaveBeenLastCalledWith('31.0.0', 10);
  });
});
