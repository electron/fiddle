import {
  findModulesInEditors,
  getIsNpmInstalled,
  installModules,
  npmRun,
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

  describe('getIsNpmInstalled()', () => {
    beforeEach(() => {
      jest.resetModuleRegistry();
    });

    afterEach(() => resetPlatform());

    it('returns true if npm installed', async () => {
      overridePlatform('darwin');

      (exec as jest.Mock).mockReturnValueOnce(
        Promise.resolve('/usr/bin/fake-npm'),
      );

      const result = await getIsNpmInstalled();

      expect(result).toBe(true);
      expect((exec as jest.Mock).mock.calls[0][1]).toBe('which npm');
    });

    it('returns true if npm installed', async () => {
      overridePlatform('win32');

      (exec as jest.Mock).mockReturnValueOnce(
        Promise.resolve('/usr/bin/fake-npm'),
      );

      const result = await getIsNpmInstalled(true);

      expect(result).toBe(true);
      expect((exec as jest.Mock).mock.calls[0][1]).toBe('where.exe npm');
    });

    it('returns false if npm not installed', async () => {
      overridePlatform('darwin');

      (exec as jest.Mock).mockReturnValueOnce(
        Promise.reject('/usr/bin/fake-npm'),
      );

      const result = await getIsNpmInstalled(true);

      expect(result).toBe(false);
      expect((exec as jest.Mock).mock.calls[0][1]).toBe('which npm');
    });

    it('uses the cache', async () => {
      (exec as jest.Mock).mockReturnValueOnce(
        Promise.resolve('/usr/bin/fake-npm'),
      );

      const one = await getIsNpmInstalled(true);
      expect(one).toBe(true);
      expect(exec as jest.Mock).toHaveBeenCalledTimes(1);

      const two = await getIsNpmInstalled();
      expect(two).toBe(true);
      expect(exec as jest.Mock).toHaveBeenCalledTimes(1);
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
        installModules({ dir: '/my/directory', package_manager: 'npm' }, 'say', 'thing');

        expect(exec).toHaveBeenCalledWith('/my/directory', 'npm install -S say thing');
      });

      it('attempts to installs all modules', async () => {
        installModules({ dir: '/my/directory', package_manager: 'npm' });

        expect(exec).toHaveBeenCalledWith('/my/directory', 'npm install --dev --prod');
      });
    })

    describe('yarn', () => {
      it('attempts to install a single module', async () => {
        installModules({ dir: '/my/directory', package_manager: 'yarn' }, 'say', 'thing');

        expect(exec).toHaveBeenCalledWith('/my/directory', 'yarn add say thing');
      });

      it('attempts to installs all modules', async () => {
        installModules({ dir: '/my/directory', package_manager: 'yarn' });

        expect(exec).toHaveBeenCalledWith('/my/directory', 'yarn add');
      });
    })
  });

  describe('npmRun()', () => {
    it('attempts to run a command', async () => {
      npmRun({ dir: '/my/directory', package_manager: 'npm' }, 'package');

      expect(exec).toHaveBeenCalledWith('/my/directory', 'npm run package');
    });
  });
});
