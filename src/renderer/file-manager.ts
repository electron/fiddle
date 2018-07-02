import * as fs from 'fs-extra';
import * as path from 'path';

import { ipcRendererManager } from './ipc';
import { IpcEvents } from '../ipc-events';
import { EditorValues } from '../interfaces';
import { INDEX_HTML_NAME, MAIN_JS_NAME, RENDERER_JS_NAME, PACKAGE_NAME } from '../constants';
import { appState } from './state';
import { getTitle } from '../utils/get-title';

export class FileManager {
  constructor() {
    this.openFiddle = this.openFiddle.bind(this);
    this.saveFiddle = this.saveFiddle.bind(this);

    ipcRendererManager.on(IpcEvents.FS_OPEN_FIDDLE, this.openFiddle);
    ipcRendererManager.on(IpcEvents.FS_SAVE_FIDDLE, this.saveFiddle);
  }

  /**
   * Tries to open a fiddle
   *
   * @param {Electron.event} _event
   * @param {string} filePath
   * @memberof FileManager
   */
  public async openFiddle(_event: Electron.Event, filePath: string) {
    if (!filePath || typeof filePath !== 'string') return;

    console.log(`FileManager: Asked to open`, filePath);

    // We'll do our best and will likely have to
    // rewrite this once we support multiple files
    const values: EditorValues = {
      html: await this.readFile(path.join(filePath, INDEX_HTML_NAME)),
      main: await this.readFile(path.join(filePath, MAIN_JS_NAME)),
      renderer: await this.readFile(path.join(filePath, RENDERER_JS_NAME)),
    };

    appState.localPath = filePath;
    window.ElectronFiddle.app.setValues(values);
    document.title = getTitle(appState);
  }

  /**
   * Saves the current Fiddle to disk. If we never saved before,
   * we'll first open the "Save" dialog.
   *
   * @param {Electron.event} _event
   * @param {string} filePath
   * @memberof FileManager
   */
  public async saveFiddle(_event: Electron.Event, filePath: string) {
    const { localPath } = appState;
    const pathToSave = filePath || localPath;

    console.log(`FileManager: Asked to save to ${pathToSave}`);

    if (!pathToSave) {
      ipcRendererManager.send(IpcEvents.FS_SAVE_FIDDLE_DIALOG);
    } else {
      const options = { includeDependencies: true, includeElectron: true };
      const values = window.ElectronFiddle.app.getValues(options);
      const { html, main, package: packageJson, renderer } = values;

      if (renderer) {
        await this.saveFile(path.join(pathToSave, RENDERER_JS_NAME), renderer);
      }

      if (main) {
        await this.saveFile(path.join(pathToSave, MAIN_JS_NAME), main);
      }

      if (html) {
        await this.saveFile(path.join(pathToSave, INDEX_HTML_NAME), html);
      }

      if (packageJson) {
        await this.saveFile(path.join(pathToSave, PACKAGE_NAME), packageJson);
      }

      if (pathToSave !== localPath) {
        appState.localPath = pathToSave;
      }
    }
  }

  /**
   * Safely attempts to read a file, doesn't crash the app if
   * it fails.
   *
   * @param {string} filePath
   * @returns {string}
   * @memberof FileManager
   */
  private async readFile(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      console.log(`FileManager: Could not read ${filePath}`, error);
      return '';
    }
  }

  /**
   * Safely attempts to save a file, doesn't crash the app if
   * it fails.
   *
   * @param {string} filePath
   * @returns {string}
   * @memberof FileManager
   */
  private async saveFile(filePath: string, content: string): Promise<void> {
    try {
      return await fs.outputFile(filePath, content, { encoding: 'utf-8' });
    } catch (error) {
      console.log(`FileManager: Could not save ${filePath}`, error);
      ipcRendererManager.send(IpcEvents.FS_SAVE_FIDDLE_ERROR, [ filePath ]);
    }
  }
}
