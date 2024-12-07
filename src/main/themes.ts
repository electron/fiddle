import * as path from 'node:path';

import { IpcMainEvent, app, shell } from 'electron';
import * as fs from 'fs-extra';
import * as namor from 'namor';

import { ipcMainManager } from './ipc';
import { IpcEvents } from '../ipc-events';
import {
  FiddleTheme,
  LoadedFiddleTheme,
  defaultDark,
  defaultLight,
} from '../themes-defaults';

export const CONFIG_PATH = path.join(app.getPath('home'), '.electron-fiddle');
export const THEMES_PATH = path.join(CONFIG_PATH, 'themes');

/**
 * Read in a theme file.
 */
export async function readThemeFile(
  name: string,
): Promise<LoadedFiddleTheme | null> {
  const file = name.endsWith('.json') ? name : `${name}.json`;
  const themePath = path.join(THEMES_PATH, file);

  try {
    const theme = await fs.readJSON(themePath);
    return {
      ...theme,
      name: theme.name || name.replace('.json', ''),
      file,
    };
  } catch (error) {
    console.warn(`Themes: Loading theme ${name} failed`, error);
    return null;
  }
}

/**
 * Create theme file and show in folder.
 */
export async function createThemeFile(
  theme: FiddleTheme | LoadedFiddleTheme,
  name?: string,
): Promise<LoadedFiddleTheme> {
  // Filter out file and css keys if they exist
  theme = Object.fromEntries(
    Object.entries(theme).filter(([key]) => !['file', 'css'].includes(key)),
  ) as FiddleTheme;

  name = name || namor.generate({ words: 2, numbers: 0 });

  const file = name.endsWith('.json') ? name : `${name}.json`;
  const themePath = path.join(THEMES_PATH, file);

  await fs.outputJSON(
    themePath,
    {
      ...theme,
      name,
    },
    { spaces: 2 },
  );

  shell.showItemInFolder(themePath);

  return {
    ...theme,
    name,
    file,
  };
}

/**
 * Reads and then returns all available themes.
 */
export async function getAvailableThemes(): Promise<Array<LoadedFiddleTheme>> {
  const themes: Array<LoadedFiddleTheme> = [defaultDark, defaultLight];

  if (!fs.existsSync(THEMES_PATH)) {
    return themes;
  }

  try {
    const themeFiles = await fs.readdir(THEMES_PATH);

    for (const file of themeFiles) {
      if (!file.endsWith('.json')) {
        continue;
      }

      const theme = await readThemeFile(file);

      if (theme) {
        themes.push(theme);
      }
    }
  } catch (error) {
    console.warn(`Themes: Could not read available themes`, error);
  }

  return themes;
}

export async function openThemeFolder() {
  // Let any errors bubble through IPC
  await fs.ensureDir(THEMES_PATH);
  shell.showItemInFolder(THEMES_PATH);
}

export function setupThemes() {
  ipcMainManager.handle(
    IpcEvents.READ_THEME_FILE,
    (_: IpcMainEvent, name: string) => readThemeFile(name),
  );
  ipcMainManager.handle(IpcEvents.GET_AVAILABLE_THEMES, (_: IpcMainEvent) =>
    getAvailableThemes(),
  );
  ipcMainManager.handle(
    IpcEvents.CREATE_THEME_FILE,
    (_: IpcMainEvent, newTheme: FiddleTheme, name?: string) =>
      createThemeFile(newTheme, name),
  );
  ipcMainManager.handle(IpcEvents.OPEN_THEME_FOLDER, (_: IpcMainEvent) =>
    openThemeFolder(),
  );
  ipcMainManager.on(IpcEvents.GET_THEME_PATH, (event) => {
    event.returnValue = THEMES_PATH;
  });
}
