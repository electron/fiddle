import {
  findModulesInEditors,
  getIsPackageManagerInstalled,
  installModules,
  packageRun,
} from '../../src/renderer/npm';
import { exec } from '../../src/utils/exec';
import { overridePlatform, resetPlatform } from '../utils';

jest.mock('../../src/utils/exec');
jest.mock('../../src/utils/import', () => ({
  fancyImport: async (_p: string) => {
    return { default: require('builtin-modules') };
  },
}));

describe('npm', () => {
  const mockMain = `
    const say = require('say');

    function hello() {
      const electron = require('electron');
      const originalFs = require('original-fs');
      const fs = require('fs');
      const privateModule = require('./hi');
    }
  `;

  describe('getIsPackageManagerInstalled()', () => {
    describe('npm()', () => {
      beforeEach(() => {
        jest.resetModuleRegistry();
      });

      afterEach(() => resetPlatform());

      it('returns true if npm installed', async () => {
        overridePlatform('darwin');

        (exec as jest.Mock).mockReturnValueOnce(
          Promise.resolve('/usr/bin/fake-npm'),
        );

        const result = await getIsPackageManagerInstalled('npm');

        expect(result).toBe(true);
        expect((exec as jest.Mock).mock.calls[0][1]).toBe('which npm');
      });

      it('returns true if npm installed', async () => {
        overridePlatform('win32');

        (exec as jest.Mock).mockReturnValueOnce(
          Promise.resolve('/usr/bin/fake-npm'),
        );

        const result = await getIsPackageManagerInstalled('npm', true);

        expect(result).toBe(true);
        expect((exec as jest.Mock).mock.calls[0][1]).toBe('where.exe npm');
      });

      it('returns false if npm not installed', async () => {
        overridePlatform('darwin');

        (exec as jest.Mock).mockReturnValueOnce(
          Promise.reject('/usr/bin/fake-npm'),
        );

        const result = await getIsPackageManagerInstalled('npm', true);

        expect(result).toBe(false);
        expect((exec as jest.Mock).mock.calls[0][1]).toBe('which npm');
      });

      it('uses the cache', async () => {
        (exec as jest.Mock).mockReturnValueOnce(
          Promise.resolve('/usr/bin/fake-npm'),
        );

        const one = await getIsPackageManagerInstalled('npm', true);
        expect(one).toBe(true);
        expect(exec as jest.Mock).toHaveBeenCalledTimes(1);

        const two = await getIsPackageManagerInstalled('npm');
        expect(two).toBe(true);
        expect(exec as jest.Mock).toHaveBeenCalledTimes(1);
      });
    });

    describe('yarn()', () => {
      beforeEach(() => {
        jest.resetModuleRegistry();
      });

      afterEach(() => resetPlatform());

      it('returns true if yarn installed', async () => {
        overridePlatform('darwin');

        (exec as jest.Mock).mockReturnValueOnce(
          Promise.resolve('/usr/bin/fake-yarn'),
        );

        const result = await getIsPackageManagerInstalled('yarn');

        expect(result).toBe(true);
        expect((exec as jest.Mock).mock.calls[0][1]).toBe('which yarn');
      });

      it('returns true if yarn installed', async () => {
        overridePlatform('win32');

        (exec as jest.Mock).mockReturnValueOnce(
          Promise.resolve('/usr/bin/fake-yarn'),
        );

        const result = await getIsPackageManagerInstalled('yarn', true);

        expect(result).toBe(true);
        expect((exec as jest.Mock).mock.calls[0][1]).toBe('where.exe yarn');
      });

      it('returns false if yarn not installed', async () => {
        overridePlatform('darwin');

        (exec as jest.Mock).mockReturnValueOnce(
          Promise.reject('/usr/bin/fake-yarn'),
        );

        const result = await getIsPackageManagerInstalled('yarn', true);

        expect(result).toBe(false);
        expect((exec as jest.Mock).mock.calls[0][1]).toBe('which yarn');
      });

      it('uses the cache', async () => {
        (exec as jest.Mock).mockReturnValueOnce(
          Promise.resolve('/usr/bin/fake-yarn'),
        );

        const one = await getIsPackageManagerInstalled('yarn', true);
        expect(one).toBe(true);
        expect(exec as jest.Mock).toHaveBeenCalledTimes(1);

        const two = await getIsPackageManagerInstalled('yarn');
        expect(two).toBe(true);
        expect(exec as jest.Mock).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('findModulesInEditors()', () => {
    it('finds modules, ignoring node and electron builtins', async () => {
      const result = await findModulesInEditors({
        html: '',
        main: mockMain,
        renderer: '',
        preload: '',
        css: '',
      });

      expect(result).toEqual(['say']);
    });
  });

  describe('installModules()', () => {
    describe('npm', () => {
      it('attempts to install a single module', async () => {
        installModules(
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
        installModules({ dir: '/my/directory', packageManager: 'npm' });

        expect(exec).toHaveBeenCalledWith(
          '/my/directory',
          'npm install --dev --prod',
        );
      });
    });

    describe('yarn', () => {
      it('attempts to install a single module', async () => {
        installModules(
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
        installModules({ dir: '/my/directory', packageManager: 'yarn' });

        expect(exec).toHaveBeenCalledWith('/my/directory', 'yarn add');
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
