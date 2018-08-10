import {
  findModulesInEditors,
  getIsNpmInstalled,
  installModules,
  npmRun
} from '../../src/renderer/npm';
import { exec } from '../../src/utils/exec';
import { overridePlatform, resetPlatform } from '../utils';

jest.mock('../../src/utils/exec');
jest.mock('../../src/utils/import', () => ({
  fancyImport: async (p: string) => {
    if (p === 'builtin-modules') {
      return { default: require('builtin-modules') };
    }
  }
}));

describe('npm', () => {
  const mockMain = `
    const say = require('say');

    function hello() {
      const electron = require('electron');
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

      (exec as jest.Mock).mockReturnValueOnce(Promise.resolve('/usr/bin/fake-npm'));

      const result = await getIsNpmInstalled();

      expect(result).toBe(true);
      expect((exec as jest.Mock).mock.calls[0][1]).toBe('which npm');
    });

    it('returns true if npm installed', async () => {
      overridePlatform('win32');

      (exec as jest.Mock).mockReturnValueOnce(Promise.resolve('/usr/bin/fake-npm'));

      const result = await getIsNpmInstalled(true);

      expect(result).toBe(true);
      expect((exec as jest.Mock).mock.calls[0][1]).toBe('where.exe npm');
    });

    it('returns false if npm not installed', async () => {
      overridePlatform('darwin');

      (exec as jest.Mock).mockReturnValueOnce(
        Promise.reject('/usr/bin/fake-npm')
      );

      const result = await getIsNpmInstalled(true);

      expect(result).toBe(false);
      expect((exec as jest.Mock).mock.calls[0][1]).toBe('which npm');
    });
  });

  describe('findModulesInEditors()', () => {
    it('finds modules', async () => {
      const result = await findModulesInEditors({
        html: '',
        main: mockMain,
        renderer: ''
      });

      expect(result).toEqual(['say']);
    });
  });

  describe('installModules()', () => {
    it('attempts to install a single module', async () => {
      installModules({ dir: '/my/directory' }, 'say', 'thing');

      expect(exec).toHaveBeenCalledWith('/my/directory', 'npm install -S say thing');
    });
  });

  describe('npmRun()', () => {
    it('attempts to run a command', async () => {
      npmRun({ dir: '/my/directory' }, 'package');

      expect(exec).toHaveBeenCalledWith('/my/directory', 'npm run package');
    });
  });
});
