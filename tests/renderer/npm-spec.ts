import { mocked } from 'ts-jest/utils';
import stripComments from 'strip-comments';

import {
  findModules,
  findModulesInEditors,
  getIsPackageManagerInstalled,
  installModules,
  packageRun,
} from '../../src/renderer/npm';
import { exec } from '../../src/utils/exec';
import { overridePlatform, resetPlatform } from '../utils';
import { DefaultEditorId } from '../../src/interfaces';
jest.mock('strip-comments');
jest.mock('../../src/utils/exec');

describe('npm', () => {
  const mockBuiltins = `
    function hello() {
      const electron = require('electron');
      const originalFs = require('original-fs');
      const fs = require('fs');
      const privateModule = require('./hi');
    }
  `;

  const mockPackages = `
    const cow = require('cow');
    const say = require('say');
  `;

  const mockComments = `
    // const cow = require('cow');
    /* const say = require('say'); */
    /**
     * const hello = require('hello');
     * const world = require('world');
    */
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

  describe('findModules()', () => {
    it('returns required modules in a JS file', async () => {
      mocked(stripComments).mockReturnValue(mockPackages);
      const modules = await findModules(mockPackages);
      expect(modules).toEqual(['cow', 'say']);
    });

    it('ignores node and electron builtins', async () => {
      mocked(stripComments).mockReturnValue(mockBuiltins);
      const modules = await findModules(mockBuiltins);
      expect(modules).toHaveLength(0);
    });

    it('ignores commented modules', async () => {
      mocked(stripComments).mockReturnValue('');
      const modules = await findModules(mockComments);
      expect(modules).toHaveLength(0);
    });
  });

  describe('findModulesInEditors()', () => {
    it('installs modules across all JavaScript files only once', async () => {
      mocked(stripComments).mockReturnValue(mockPackages);
      const result = await findModulesInEditors({
        [DefaultEditorId.html]: '',
        [DefaultEditorId.main]: mockPackages,
        [DefaultEditorId.renderer]: mockPackages,
        [DefaultEditorId.preload]: mockPackages,
        [DefaultEditorId.css]: '',
      });

      expect(result).toHaveLength(2);
      expect(result).toEqual(['cow', 'say']);
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

        expect(exec).toHaveBeenCalledWith<any>(
          '/my/directory',
          'npm install -S say thing',
        );
      });

      it('attempts to installs all modules', async () => {
        installModules({ dir: '/my/directory', packageManager: 'npm' });

        expect(exec).toHaveBeenCalledWith<any>(
          '/my/directory',
          'npm install --also=dev --prod',
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

        expect(exec).toHaveBeenCalledWith<any>(
          '/my/directory',
          'yarn add say thing',
        );
      });

      it('attempts to installs all modules', async () => {
        installModules({ dir: '/my/directory', packageManager: 'yarn' });

        expect(exec).toHaveBeenCalledWith<any>('/my/directory', 'yarn add');
      });
    });
  });

  describe('packageRun()', () => {
    it('attempts to run a command via npm', async () => {
      packageRun({ dir: '/my/directory', packageManager: 'npm' }, 'package');

      expect(exec).toHaveBeenCalledWith<any>(
        '/my/directory',
        'npm run package',
      );
    });

    it('attempts to run a command via yarn', async () => {
      packageRun({ dir: '/my/directory', packageManager: 'yarn' }, 'package');

      expect(exec).toHaveBeenCalledWith<any>(
        '/my/directory',
        'yarn run package',
      );
    });
  });
});
