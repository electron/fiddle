import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { isPackaged: false } }));

const { resolveSfwEntry, sfwPathFor, SFW_DIR, SFW_FILES, SFW_PACKAGE_ENTRY } =
  await import('./sfw');

const resolve = createRequire(import.meta.url).resolve;
const noResolve = () => {
  throw new Error('not in node_modules');
};

describe('resolveSfwEntry', () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  /** A packaged layout: `<dir>/resources/sfw/{package.json,dist/sfw.mjs}`. */
  function packagedLayout(script = '#!/usr/bin/env node\n'): string {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sfw-test-'));
    const shipped = path.join(dir, 'resources', SFW_DIR);
    fs.mkdirSync(path.join(shipped, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(shipped, 'package.json'), '{"version":"1.0.0"}');
    fs.writeFileSync(path.join(shipped, 'dist', 'sfw.mjs'), script);
    return dir;
  }

  it('uses the package in node_modules in dev and test runs', async () => {
    const fake = (id: string) => `/repo/node_modules/${id}`;
    const existsSync = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    try {
      expect(
        await resolveSfwEntry({
          packaged: false,
          resourcesPath: '/res',
          userData: '/data',
          resolve: fake,
        }),
      ).toBe(`/repo/node_modules/${SFW_PACKAGE_ENTRY}`);
    } finally {
      existsSync.mockRestore();
    }
  });

  it('runs a per-user copy of <resources>/sfw in packaged builds, so sfw writes outside the install dir', async () => {
    const root = packagedLayout();
    const userData = path.join(root, 'data');
    const file = await resolveSfwEntry({
      packaged: true,
      resourcesPath: path.join(root, 'resources'),
      userData,
      resolve: noResolve,
    });
    expect(file).toBe(path.join(userData, SFW_DIR, 'dist', 'sfw.mjs'));
    for (const name of SFW_FILES) {
      expect(fs.readFileSync(path.join(userData, SFW_DIR, name))).toEqual(
        fs.readFileSync(path.join(root, 'resources', SFW_DIR, name)),
      );
    }
  });

  it('refreshes the copy when the shipped script changes and leaves it alone otherwise', async () => {
    const root = packagedLayout('// v1\n');
    const location = {
      packaged: true,
      resourcesPath: path.join(root, 'resources'),
      userData: path.join(root, 'data'),
      resolve: noResolve,
    };
    const file = (await resolveSfwEntry(location))!;
    const first = fs.statSync(file).mtimeMs;
    await resolveSfwEntry(location);
    expect(fs.statSync(file).mtimeMs).toBe(first);
    fs.writeFileSync(path.join(root, 'resources', SFW_DIR, 'dist', 'sfw.mjs'), '// v2\n');
    await resolveSfwEntry(location);
    expect(fs.readFileSync(file, 'utf8')).toBe('// v2\n');
  });

  it('is undefined when the build has no script', async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sfw-test-'));
    expect(
      await resolveSfwEntry({
        packaged: true,
        resourcesPath: dir,
        userData: path.join(dir, 'data'),
        resolve: noResolve,
      }),
    ).toBeUndefined();
    expect(
      await resolveSfwEntry({
        packaged: false,
        resourcesPath: dir,
        userData: path.join(dir, 'data'),
        resolve: noResolve,
      }),
    ).toBeUndefined();
  });

  it('is shipped by forge.config.ts', () => {
    const config = fs.readFileSync(
      path.join(import.meta.dirname, '../../../forge.config.ts'),
      'utf8',
    );
    expect(config).toContain("resolve('sfw/package.json')");
    expect(config).toContain('stageSfw()');
  });

  // Skipped when the sfw package isn't installed in node_modules.
  let installed: string | undefined;
  try {
    installed = resolve(SFW_PACKAGE_ENTRY);
  } catch {
    installed = undefined;
  }

  it.skipIf(installed === undefined)(
    'finds the real sfw.mjs in node_modules',
    async () => {
      const file = await resolveSfwEntry({
        packaged: false,
        resourcesPath: '',
        userData: '',
        resolve,
      });
      expect(fs.readFileSync(file!, 'utf8')).toMatch(/^#!\/usr\/bin\/env node/);
    },
  );

  it.skipIf(installed === undefined)(
    'lays the real package out so the copied script parses and finds the ../package.json it reads on load',
    async () => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sfw-test-'));
      const root = path.dirname(resolve('sfw/package.json'));
      for (const name of SFW_FILES) {
        const target = path.join(dir, 'resources', SFW_DIR, name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(root, name), target);
      }
      const file = await resolveSfwEntry({
        packaged: true,
        resourcesPath: path.join(dir, 'resources'),
        userData: path.join(dir, 'data'),
        resolve: noResolve,
      });
      // `--check` parses without running; a plain import would start a download.
      expect(() =>
        execFileSync(process.execPath, ['--check', file!], { stdio: 'pipe' }),
      ).not.toThrow();
      // What the script reads on load is next to it.
      expect(
        JSON.parse(
          fs.readFileSync(path.join(path.dirname(file!), '..', 'package.json'), 'utf8'),
        ),
      ).toHaveProperty('version');
    },
  );
});

describe('sfwPathFor', () => {
  it('is undefined when Socket Firewall is off, found or not', async () => {
    expect(await sfwPathFor(false, () => Promise.resolve(undefined))).toBeUndefined();
    expect(
      await sfwPathFor(false, () => Promise.resolve('/res/sfw.mjs')),
    ).toBeUndefined();
  });

  it('is the script when Socket Firewall is on', async () => {
    expect(await sfwPathFor(true, () => Promise.resolve('/res/sfw.mjs'))).toBe(
      '/res/sfw.mjs',
    );
  });

  it('throws instead of installing unprotected when the script is missing', async () => {
    await expect(
      sfwPathFor(true, () => Promise.resolve(undefined)),
    ).rejects.toMatchObject({ code: 'unavailable' });
  });
});
