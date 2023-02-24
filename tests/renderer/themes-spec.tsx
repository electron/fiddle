import * as path from 'path';

import * as fs from 'fs-extra';

import {
  activateTheme,
  getAvailableThemes,
  getTheme,
  readThemeFile,
} from '../../src/renderer/themes';
import { DefaultThemes } from '../../src/renderer/themes-defaults';

jest.mock('fs-extra');

describe('themes', () => {
  describe('activateTheme()', () => {
    it('attempts to activate a theme', async () => {
      const { editor } = window.ElectronFiddle.monaco;

      activateTheme(await getTheme());

      expect(editor.defineTheme).toHaveBeenCalled();
      expect(editor.setTheme).toHaveBeenCalled();
      expect((editor.defineTheme as jest.Mock).mock.calls[0][1].base).toBe(
        'vs-dark',
      );
    });
  });

  describe('getAvailableThemes()', () => {
    it('returns default themes if the folder does not exist', async () => {
      const themes = await getAvailableThemes();
      expect(themes).toHaveLength(2);
    });

    it('reads the themes folder for themes', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdir as jest.Mock).mockReturnValueOnce([
        'test-theme1.json',
        'test-theme2.json',
      ]);
      (fs.readJSON as jest.Mock).mockReturnValue({ test: true });

      const themes = await getAvailableThemes();

      expect(themes).toHaveLength(4);
      expect(themes[2]).toEqual({
        test: true,
        name: 'test-theme1',
        file: 'test-theme1.json',
      });
      expect(themes[3]).toEqual({
        file: 'test-theme2.json',
        name: 'test-theme2',
        test: true,
      });
    });

    it('handles a readdir error', async () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
      (fs.readdir as jest.Mock).mockImplementationOnce(() =>
        Promise.reject('Bwap'),
      );

      const themes = await getAvailableThemes();
      expect(themes).toHaveLength(2);
    });

    it('handles a readJSON error', async () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
      (fs.readdir as jest.Mock).mockImplementationOnce(() => ['hi']);
      (fs.readJSON as jest.Mock).mockImplementationOnce(() =>
        Promise.reject('Bwap'),
      );

      const themes = await getAvailableThemes();
      expect(themes).toHaveLength(2);
    });
  });

  describe('getTheme()', () => {
    it('returns a default theme', async () => {
      const theme = await getTheme();
      expect(theme.name).toBe('Fiddle (Dark)');
    });

    it('returns a default theme for null', async () => {
      const theme = await getTheme(null);
      expect(theme.name).toBe('Fiddle (Dark)');
    });

    it('returns a named theme', async () => {
      (fs.readJSON as jest.Mock).mockReturnValue({
        name: 'Test',
        common: { test: true },
      });

      const theme = await getTheme('test');
      expect(theme.name).toBe('Test');
    });

    it('handles a read error', async () => {
      (fs.readJSON as jest.Mock).mockImplementationOnce(() =>
        Promise.reject('Bwap'),
      );

      const theme = await getTheme('test');
      expect(theme.name).toBe('Fiddle (Dark)');
    });
  });

  describe('readThemeFile()', () => {
    it('returns the default (light) theme', async () => {
      const theme = await readThemeFile(DefaultThemes.LIGHT);
      expect(theme!.name).toBe('Fiddle (Light)');
    });

    it('returns the default (Dark) theme', async () => {
      const theme = await readThemeFile(DefaultThemes.DARK);
      expect(theme!.name).toBe('Fiddle (Dark)');
    });

    it('returns the default (Dark) theme', async () => {
      const theme = await readThemeFile();
      expect(theme!.name).toBe('Fiddle (Dark)');
    });

    it('reads the right file if ends with .json', async () => {
      (fs.readJSON as jest.Mock).mockReturnValueOnce({});

      const theme = await readThemeFile('myfile.json');
      const expected = path.normalize(`~/.electron-fiddle/themes/myfile.json`);

      expect(theme).toBeTruthy();
      expect(fs.readJSON).toHaveBeenCalledWith(expected);
    });

    it('reads the right file if does not end with .json', async () => {
      (fs.readJSON as jest.Mock).mockReturnValueOnce({});

      const theme = await readThemeFile('myfile');
      const expected = path.normalize(`~/.electron-fiddle/themes/myfile.json`);

      expect(theme).toBeTruthy();
      expect(fs.readJSON).toHaveBeenCalledWith(expected);
    });
  });
});
