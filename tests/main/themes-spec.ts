import * as path from 'node:path';

import { shell } from 'electron';
import * as fs from 'fs-extra';
import { mocked } from 'jest-mock';

import {
  THEMES_PATH,
  createThemeFile,
  getAvailableThemes,
  openThemeFolder,
  readThemeFile,
} from '../../src/main/themes';
import { LoadedFiddleTheme, defaultDark } from '../../src/themes-defaults';

jest.mock('fs-extra');

describe('themes', () => {
  describe('getAvailableThemes()', () => {
    it('returns default themes if the folder does not exist', async () => {
      const themes = await getAvailableThemes();
      expect(themes).toHaveLength(2);
    });

    it('reads the themes folder for themes', async () => {
      mocked(fs.existsSync).mockReturnValue(true);
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
      mocked(fs.existsSync).mockReturnValue(true);
      (fs.readdir as jest.Mock).mockReturnValueOnce([
        'test-theme1.json',
        '.DS_Store',
      ]);
      (fs.readJSON as jest.Mock).mockResolvedValue({ test: true });

      const themes = await getAvailableThemes();

      expect(themes).toHaveLength(3);
      expect(themes[2]).toEqual({
        test: true,
        name: 'test-theme1',
        file: 'test-theme1.json',
      });
    });

    it('handles a readdir error', async () => {
      mocked(fs.existsSync).mockReturnValueOnce(true);
      (fs.readdir as jest.Mock).mockRejectedValueOnce('Bwap');

      const themes = await getAvailableThemes();
      expect(themes).toHaveLength(2);
    });

    it('handles a readJSON error', async () => {
      mocked(fs.existsSync).mockReturnValueOnce(true);
      (fs.readdir as jest.Mock).mockImplementationOnce(() => ['hi']);
      (fs.readJSON as jest.Mock).mockRejectedValueOnce('Bwap');

      const themes = await getAvailableThemes();
      expect(themes).toHaveLength(2);
    });
  });

  describe('readThemeFile()', () => {
    it('reads the right file if ends with .json', async () => {
      (fs.readJSON as jest.Mock).mockResolvedValueOnce({});

      const theme = await readThemeFile('myfile.json');
      const expected = path.normalize(`~/.electron-fiddle/themes/myfile.json`);

      expect(theme).toBeTruthy();
      expect(fs.readJSON).toHaveBeenCalledWith(expected);
    });

    it('reads the right file if does not end with .json', async () => {
      (fs.readJSON as jest.Mock).mockResolvedValueOnce({});

      const theme = await readThemeFile('myfile');
      const expected = path.normalize(`~/.electron-fiddle/themes/myfile.json`);

      expect(theme).toBeTruthy();
      expect(fs.readJSON).toHaveBeenCalledWith(expected);
    });
  });

  describe('createThemeFile()', () => {
    let defaultTheme: LoadedFiddleTheme;

    beforeEach(async () => {
      defaultTheme = defaultDark;
    });

    it('filters out file and css keys', async () => {
      const theme = await createThemeFile(
        { ...defaultTheme, file: '/path/file', css: '' },
        'theme-name',
      );
      expect(theme.name).toBe('theme-name');
      expect(theme.css).not.toBeDefined();
      expect(theme.file).toMatch(/theme-name.json$/);
    });

    it('uses the name provided', async () => {
      const theme = await createThemeFile(defaultTheme, 'theme-name');
      expect(theme.name).toBe('theme-name');
      expect(theme.file).toMatch(/theme-name.json$/);
    });

    it('generates a name if not provided', async () => {
      const theme = await createThemeFile(defaultTheme);
      expect(theme.name).toBeDefined();
      expect(theme.file.endsWith(`${theme.name}.json`)).toBe(true);
    });

    it('appends .json to name if needed', async () => {
      const { file } = await createThemeFile(defaultTheme, 'theme-name');
      expect(file).toEqual('theme-name.json');
    });

    it('writes the file', async () => {
      const theme = { ...defaultTheme };
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
      await createThemeFile(defaultTheme, 'theme-name');
      expect(shell.showItemInFolder).toHaveBeenCalledWith(
        path.join(THEMES_PATH, 'theme-name.json'),
      );
    });
  });

  describe('openThemeFolder()', () => {
    it('attempts to open the folder', async () => {
      shell.showItemInFolder = jest.fn();
      await openThemeFolder();

      expect(shell.showItemInFolder).toHaveBeenCalled();
    });
  });
});
