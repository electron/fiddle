import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addModules,
  getIsPackageManagerInstalled,
  getSfwPath,
  packageRun,
} from '../../src/main/npm';
import { exec, execFile } from '../../src/main/utils/exec';
import { overridePlatform, resetPlatform } from '../utils';
vi.mock('../../src/main/utils/exec');

const tmpModuleDir = path.join(os.tmpdir(), 'my-directory');

describe('npm', () => {
  describe('getIsPackageManagerInstalled()', () => {
    describe('npm()', () => {
      beforeEach(() => {
        vi.resetModules();
      });

      afterEach(() => resetPlatform());

      it('returns true if npm installed', async () => {
        overridePlatform('darwin');

        vi.mocked(exec).mockResolvedValueOnce('/usr/bin/fake-npm');

        const result = await getIsPackageManagerInstalled('npm');

        expect(result).toBe(true);
        expect(exec).toBeCalledWith(expect.anything(), 'which npm');
      });

      it('returns true if npm installed', async () => {
        overridePlatform('win32');

        vi.mocked(exec).mockResolvedValueOnce('/usr/bin/fake-npm');

        const result = await getIsPackageManagerInstalled('npm', true);

        expect(result).toBe(true);
        expect(exec).toBeCalledWith(expect.anything(), 'where.exe npm');
      });

      it('returns false if npm not installed', async () => {
        overridePlatform('darwin');

        vi.mocked(exec).mockRejectedValueOnce('/usr/bin/fake-npm');

        const result = await getIsPackageManagerInstalled('npm', true);

        expect(result).toBe(false);
        expect(exec).toBeCalledWith(expect.anything(), 'which npm');
      });

      it('uses the cache', async () => {
        vi.mocked(exec).mockResolvedValueOnce('/usr/bin/fake-npm');

        const one = await getIsPackageManagerInstalled('npm', true);
        expect(one).toBe(true);
        expect(exec).toHaveBeenCalledTimes(1);

        const two = await getIsPackageManagerInstalled('npm');
        expect(two).toBe(true);
        expect(exec).toHaveBeenCalledTimes(1);
      });
    });

    describe('yarn()', () => {
      beforeEach(() => {
        vi.resetModules();
      });

      afterEach(() => resetPlatform());

      it('returns true if yarn installed', async () => {
        overridePlatform('darwin');

        vi.mocked(exec).mockResolvedValueOnce('/usr/bin/fake-yarn');

        const result = await getIsPackageManagerInstalled('yarn');

        expect(result).toBe(true);
        expect(exec).toBeCalledWith(expect.anything(), 'which yarn');
      });

      it('returns true if yarn installed', async () => {
        overridePlatform('win32');

        vi.mocked(exec).mockResolvedValueOnce('/usr/bin/fake-yarn');

        const result = await getIsPackageManagerInstalled('yarn', true);

        expect(result).toBe(true);
        expect(exec).toBeCalledWith(expect.anything(), 'where.exe yarn');
      });

      it('returns false if yarn not installed', async () => {
        overridePlatform('darwin');

        vi.mocked(exec).mockRejectedValueOnce('/usr/bin/fake-yarn');

        const result = await getIsPackageManagerInstalled('yarn', true);

        expect(result).toBe(false);
        expect(exec).toBeCalledWith(expect.anything(), 'which yarn');
      });

      it('uses the cache', async () => {
        vi.mocked(exec).mockResolvedValueOnce('/usr/bin/fake-yarn');

        const one = await getIsPackageManagerInstalled('yarn', true);
        expect(one).toBe(true);
        expect(exec).toHaveBeenCalledTimes(1);

        const two = await getIsPackageManagerInstalled('yarn');
        expect(two).toBe(true);
        expect(exec).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('getSfwPath()', () => {
    it('returns the path to the embedded sfw script', () => {
      expect(getSfwPath()).toMatch(/sfw\.mjs$/);
    });
  });

  describe('addModules()', () => {
    it('rejects dirs outside the temp directory', async () => {
      await expect(
        addModules({ dir: '/not/a/tmp/path', packageManager: 'npm' }),
      ).rejects.toThrow('addModules: dir must be inside the temp directory');
    });

    describe('npm', () => {
      it('attempts to install a single module', async () => {
        addModules(
          { dir: tmpModuleDir, packageManager: 'npm' },
          'say',
          'thing',
        );

        expect(execFile).toHaveBeenCalledWith(tmpModuleDir, 'npm', [
          'install',
          '-S',
          'say',
          'thing',
        ]);
      });

      it('attempts to install all modules', async () => {
        addModules({ dir: tmpModuleDir, packageManager: 'npm' });

        expect(execFile).toHaveBeenCalledWith(tmpModuleDir, 'npm', [
          'install',
          '-S',
        ]);
      });
    });

    describe('yarn', () => {
      it('attempts to install a single module', async () => {
        addModules(
          { dir: tmpModuleDir, packageManager: 'yarn' },
          'say',
          'thing',
        );

        expect(execFile).toHaveBeenCalledWith(tmpModuleDir, 'yarn', [
          'add',
          'say',
          'thing',
        ]);
      });

      it('attempts to installs all modules', async () => {
        addModules({ dir: tmpModuleDir, packageManager: 'yarn' });

        expect(execFile).toHaveBeenCalledWith(tmpModuleDir, 'yarn', [
          'install',
        ]);
      });
    });

    describe('with socket firewall', () => {
      it('uses sfw when enabled for npm', async () => {
        await addModules(
          {
            dir: tmpModuleDir,
            packageManager: 'npm',
            useSocketFirewall: true,
          },
          'lodash',
        );

        expect(execFile).toHaveBeenCalledWith(
          tmpModuleDir,
          'node',
          expect.arrayContaining([
            expect.stringMatching(/sfw\.mjs$/),
            'npm',
            'install',
            '-S',
            'lodash',
          ]),
        );
      });

      it('uses sfw when enabled for yarn', async () => {
        await addModules(
          {
            dir: tmpModuleDir,
            packageManager: 'yarn',
            useSocketFirewall: true,
          },
          'lodash',
        );

        expect(execFile).toHaveBeenCalledWith(
          tmpModuleDir,
          'node',
          expect.arrayContaining([
            expect.stringMatching(/sfw\.mjs$/),
            'yarn',
            'add',
            'lodash',
          ]),
        );
      });

      it('does not use sfw when disabled', async () => {
        await addModules(
          {
            dir: tmpModuleDir,
            packageManager: 'npm',
            useSocketFirewall: false,
          },
          'lodash',
        );

        expect(execFile).toHaveBeenCalledWith(tmpModuleDir, 'npm', [
          'install',
          '-S',
          'lodash',
        ]);
      });
    });
  });

  describe('packageRun()', () => {
    it('attempts to run a command via npm', async () => {
      packageRun({ dir: '/my/directory', packageManager: 'npm' }, 'package');

      expect(execFile).toHaveBeenCalledWith('/my/directory', 'npm', [
        'run',
        'package',
      ]);
    });

    it('attempts to run a command via yarn', async () => {
      packageRun({ dir: '/my/directory', packageManager: 'yarn' }, 'package');

      expect(execFile).toHaveBeenCalledWith('/my/directory', 'yarn', [
        'run',
        'package',
      ]);
    });
  });
});
