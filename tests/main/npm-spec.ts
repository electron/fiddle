import { mocked } from 'jest-mock';

import {
  addModules,
  getIsPackageManagerInstalled,
  packageRun,
} from '../../src/main/npm';
import { exec } from '../../src/main/utils/exec';
import { overridePlatform, resetPlatform } from '../utils';
jest.mock('../../src/main/utils/exec');

describe('npm', () => {
  describe('getIsPackageManagerInstalled()', () => {
    describe('npm()', () => {
      beforeEach(() => {
        jest.resetModules();
      });

      afterEach(() => resetPlatform());

      it('returns true if npm installed', async () => {
        overridePlatform('darwin');

        mocked(exec).mockResolvedValueOnce('/usr/bin/fake-npm');

        const result = await getIsPackageManagerInstalled('npm');

        expect(result).toBe(true);
        expect(exec).toBeCalledWith(expect.anything(), 'which npm');
      });

      it('returns true if npm installed', async () => {
        overridePlatform('win32');

        mocked(exec).mockResolvedValueOnce('/usr/bin/fake-npm');

        const result = await getIsPackageManagerInstalled('npm', true);

        expect(result).toBe(true);
        expect(exec).toBeCalledWith(expect.anything(), 'where.exe npm');
      });

      it('returns false if npm not installed', async () => {
        overridePlatform('darwin');

        mocked(exec).mockRejectedValueOnce('/usr/bin/fake-npm');

        const result = await getIsPackageManagerInstalled('npm', true);

        expect(result).toBe(false);
        expect(exec).toBeCalledWith(expect.anything(), 'which npm');
      });

      it('uses the cache', async () => {
        mocked(exec).mockResolvedValueOnce('/usr/bin/fake-npm');

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
        jest.resetModules();
      });

      afterEach(() => resetPlatform());

      it('returns true if yarn installed', async () => {
        overridePlatform('darwin');

        mocked(exec).mockResolvedValueOnce('/usr/bin/fake-yarn');

        const result = await getIsPackageManagerInstalled('yarn');

        expect(result).toBe(true);
        expect(exec).toBeCalledWith(expect.anything(), 'which yarn');
      });

      it('returns true if yarn installed', async () => {
        overridePlatform('win32');

        mocked(exec).mockResolvedValueOnce('/usr/bin/fake-yarn');

        const result = await getIsPackageManagerInstalled('yarn', true);

        expect(result).toBe(true);
        expect(exec).toBeCalledWith(expect.anything(), 'where.exe yarn');
      });

      it('returns false if yarn not installed', async () => {
        overridePlatform('darwin');

        mocked(exec).mockRejectedValueOnce('/usr/bin/fake-yarn');

        const result = await getIsPackageManagerInstalled('yarn', true);

        expect(result).toBe(false);
        expect(exec).toBeCalledWith(expect.anything(), 'which yarn');
      });

      it('uses the cache', async () => {
        mocked(exec).mockResolvedValueOnce('/usr/bin/fake-yarn');

        const one = await getIsPackageManagerInstalled('yarn', true);
        expect(one).toBe(true);
        expect(exec).toHaveBeenCalledTimes(1);

        const two = await getIsPackageManagerInstalled('yarn');
        expect(two).toBe(true);
        expect(exec).toHaveBeenCalledTimes(1);
      });
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

        expect(exec).toHaveBeenCalledWith(
          '/my/directory',
          'npm install -S say thing',
        );
      });

      it('attempts to installs all modules', async () => {
        addModules({ dir: '/my/directory', packageManager: 'npm' });

        expect(exec).toHaveBeenCalledWith(
          '/my/directory',
          'npm install --also=dev --prod',
        );
      });
    });

    describe('yarn', () => {
      it('attempts to install a single module', async () => {
        addModules(
          { dir: '/my/directory', packageManager: 'yarn' },
          'say',
          'thing',
        );

        expect(exec).toHaveBeenCalledWith(
          '/my/directory',
          'yarn add say thing',
        );
      });

      it('attempts to installs all modules', async () => {
        addModules({ dir: '/my/directory', packageManager: 'yarn' });

        expect(exec).toHaveBeenCalledWith('/my/directory', 'yarn install');
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
