import * as path from 'path';

import { shell } from 'electron';
import * as fs from 'fs-extra';

import {
  THEMES_PATH,
  activateTheme,
  createThemeFile,
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

      expect(editor.setTheme).toHaveBeenCalled();
      expect(editor.defineTheme).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ base: 'vs-dark' }),
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

    it('only reads files ending in .json', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdir as jest.Mock).mockReturnValueOnce([
        'test-theme1.json',
        '.DS_Store',
      ]);
      (fs.readJSON as jest.Mock).mockReturnValue({ test: true });

      const themes = await getAvailableThemes();

      expect(themes).toHaveLength(3);
      expect(themes[2]).toEqual({
        test: true,
        name: 'test-theme1',
        file: 'test-theme1.json',
      });
    });

    it('handles a readdir error', async () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
      (fs.readdir as jest.Mock).mockRejectedValueOnce('Bwap');

      const themes = await getAvailableThemes();
      expect(themes).toHaveLength(2);
    });

    it('handles a readJSON error', async () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
      (fs.readdir as jest.Mock).mockImplementationOnce(() => ['hi']);
      (fs.readJSON as jest.Mock).mockRejectedValueOnce('Bwap');

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
      (fs.readJSON as jest.Mock).mockRejectedValueOnce('Bwap');

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

  describe('createThemeFile()', () => {
    it('filters out file and css keys', async () => {
      const themeToSave = await getTheme();
      const theme = await createThemeFile(
        { ...themeToSave, file: '/path/file', css: '' },
        'theme-name',
      );
      expect(theme.name).toBe('theme-name');
      expect(theme.css).not.toBeDefined();
      expect(theme.file).toMatch(/theme-name.json$/);
    });

    it('uses the name provided', async () => {
      const theme = await createThemeFile(await getTheme(), 'theme-name');
      expect(theme.name).toBe('theme-name');
      expect(theme.file).toMatch(/theme-name.json$/);
    });

    it('generates a name if not provided', async () => {
      const theme = await createThemeFile(await getTheme());
      expect(theme.name).toBeDefined();
      expect(theme.file.endsWith(`${theme.name}.json`)).toBe(true);
    });

    it('appends .json to name if needed', async () => {
      const { file } = await createThemeFile(await getTheme(), 'theme-name');
      expect(file).toEqual('theme-name.json');
    });

    it('writes the file', async () => {
      const theme = await getTheme();
      const name = 'theme-name';
      await createThemeFile(theme, name);
      delete (theme as any).file;
      delete theme.css;
      expect(fs.outputJSON).toHaveBeenCalledWith(
        path.join(THEMES_PATH, `${name}.json`),
        expect.objectContaining({
          ...theme,
          name,
        }),
        expect.anything(),
      );
    });

    it('calls shell.showItemInFolder', async () => {
      await createThemeFile(await getTheme(), 'theme-name');
      expect(shell.showItemInFolder).toHaveBeenCalledWith(
        path.join(THEMES_PATH, 'theme-name.json'),
      );
    });
  });
});
