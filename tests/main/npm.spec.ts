import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addModules,
  getIsPackageManagerInstalled,
  getIsSfwInstalled,
  packageRun,
} from '../../src/main/npm';
import { exec, execFile } from '../../src/main/utils/exec';
import { overridePlatform, resetPlatform } from '../utils';
vi.mock('../../src/main/utils/exec');

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

  describe('getIsSfwInstalled()', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    afterEach(() => resetPlatform());

    it('returns true if sfw installed on darwin', async () => {
      overridePlatform('darwin');

      vi.mocked(exec).mockResolvedValueOnce('/usr/local/bin/sfw');

      const result = await getIsSfwInstalled(true);

      expect(result).toBe(true);
      expect(exec).toBeCalledWith(expect.anything(), 'which sfw');
    });

    it('returns true if sfw installed on win32', async () => {
      overridePlatform('win32');

      vi.mocked(exec).mockResolvedValueOnce('C:\\Program Files\\sfw.exe');

      const result = await getIsSfwInstalled(true);

      expect(result).toBe(true);
      expect(exec).toBeCalledWith(expect.anything(), 'where.exe sfw');
    });

    it('returns false if sfw not installed', async () => {
      overridePlatform('darwin');

      vi.mocked(exec).mockRejectedValueOnce(new Error('not found'));

      const result = await getIsSfwInstalled(true);

      expect(result).toBe(false);
      expect(exec).toBeCalledWith(expect.anything(), 'which sfw');
    });

    it('uses the cache', async () => {
      vi.mocked(exec).mockResolvedValueOnce('/usr/local/bin/sfw');

      const one = await getIsSfwInstalled(true);
      expect(one).toBe(true);
      expect(exec).toHaveBeenCalledTimes(1);

      const two = await getIsSfwInstalled();
      expect(two).toBe(true);
      expect(exec).toHaveBeenCalledTimes(1);
    });
  });

  describe('addModules()', () => {
    describe('npm', () => {
      it('attempts to install a single module', async () => {
        addModules(
          { dir: '/my/directory', packageManager: 'npm' },
          'say',
          'thing',
        );

        expect(execFile).toHaveBeenCalledWith('/my/directory', 'npm', [
          'install',
          '-S',
          'say',
          'thing',
        ]);
      });

      it('attempts to install all modules', async () => {
        addModules({ dir: '/my/directory', packageManager: 'npm' });

        expect(execFile).toHaveBeenCalledWith('/my/directory', 'npm', [
          'install',
          '-S',
        ]);
      });
    });

    describe('yarn', () => {
      it('attempts to install a single module', async () => {
        addModules(
          { dir: '/my/directory', packageManager: 'yarn' },
          'say',
          'thing',
        );

        expect(execFile).toHaveBeenCalledWith('/my/directory', 'yarn', [
          'add',
          'say',
          'thing',
        ]);
      });

      it('attempts to installs all modules', async () => {
        addModules({ dir: '/my/directory', packageManager: 'yarn' });

        expect(execFile).toHaveBeenCalledWith('/my/directory', 'yarn', [
          'install',
        ]);
      });
    });

    describe('with socket firewall', () => {
      afterEach(() => resetPlatform());

      it('uses sfw when enabled and available for npm', async () => {
        vi.resetModules();
        const { addModules: addModulesFresh } = await import(
          '../../src/main/npm'
        );
        overridePlatform('darwin');
        vi.mocked(exec).mockResolvedValueOnce('/usr/local/bin/sfw');

        await addModulesFresh(
          {
            dir: '/my/directory',
            packageManager: 'npm',
            useSocketFirewall: true,
          },
          'lodash',
        );

        expect(execFile).toHaveBeenCalledWith('/my/directory', 'sfw', [
          'npm',
          'install',
          '-S',
          'lodash',
        ]);
      });

      it('uses sfw when enabled and available for yarn', async () => {
        vi.resetModules();
        const { addModules: addModulesFresh } = await import(
          '../../src/main/npm'
        );
        overridePlatform('darwin');
        vi.mocked(exec).mockResolvedValueOnce('/usr/local/bin/sfw');

        await addModulesFresh(
          {
            dir: '/my/directory',
            packageManager: 'yarn',
            useSocketFirewall: true,
          },
          'lodash',
        );

        expect(execFile).toHaveBeenCalledWith('/my/directory', 'sfw', [
          'yarn',
          'add',
          'lodash',
        ]);
      });

      it('falls back to direct npm when sfw not available', async () => {
        vi.resetModules();
        const { addModules: addModulesFresh } = await import(
          '../../src/main/npm'
        );
        overridePlatform('darwin');
        vi.mocked(exec).mockRejectedValueOnce(new Error('not found'));

        await addModulesFresh(
          {
            dir: '/my/directory',
            packageManager: 'npm',
            useSocketFirewall: true,
          },
          'lodash',
        );

        expect(execFile).toHaveBeenCalledWith('/my/directory', 'npm', [
          'install',
          '-S',
          'lodash',
        ]);
      });

      it('does not use sfw when disabled', async () => {
        addModules(
          {
            dir: '/my/directory',
            packageManager: 'npm',
            useSocketFirewall: false,
          },
          'lodash',
        );

        expect(execFile).toHaveBeenCalledWith('/my/directory', 'npm', [
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

      expect(exec).toHaveBeenCalledWith('/my/directory', 'npm run package');
    });

    it('attempts to run a command via yarn', async () => {
      packageRun({ dir: '/my/directory', packageManager: 'yarn' }, 'package');

      expect(exec).toHaveBeenCalledWith('/my/directory', 'yarn run package');
    });
  });
});
