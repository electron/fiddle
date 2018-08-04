import { findModulesInEditors, installModules, npmRun } from '../../src/renderer/npm';
import { exec } from '../../src/utils/exec';

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

      expect(exec).toHaveBeenCalledWith('/my/directory', 'npm i -S say thing');
    });
  });

  describe('npmRun()', () => {
    it('attempts to run a command', async () => {
      npmRun({ dir: '/my/directory' }, 'package');

      expect(exec).toHaveBeenCalledWith('/my/directory', 'npm run package');
    });
  });
});
