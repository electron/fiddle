import * as path from 'path';
import { shell } from 'electron';
import * as fsType from 'fs-extra';

import { ipcRendererManager } from './ipc';
import { IpcEvents } from '../ipc-events';
import { EditorValues, Files, FileTransform } from '../interfaces';
import { INDEX_HTML_NAME, MAIN_JS_NAME, RENDERER_JS_NAME, PACKAGE_NAME } from '../constants';
import { appState } from './state';
import { getTitle } from '../utils/get-title';
import { fancyImport } from '../utils/import';
import { dotfilesTransform } from './transforms/dotfiles';
import { forgeTransform } from './transforms/forge';
import { PackageJsonOptions, DEFAULT_OPTIONS } from '../utils/get-package';

export class FileManager {
  constructor() {
    this.openFiddle = this.openFiddle.bind(this);
    this.saveFiddle = this.saveFiddle.bind(this);

    ipcRendererManager.on(IpcEvents.FS_OPEN_FIDDLE, (_event, filePath) => {
      this.openFiddle(filePath);
    });

    ipcRendererManager.on(IpcEvents.FS_SAVE_FIDDLE, (_event, filePath) => {
      this.saveFiddle(filePath, dotfilesTransform);
    });

    ipcRendererManager.on(IpcEvents.FS_SAVE_FIDDLE_FORGE, (_event, filePath) => {
      this.saveFiddle(filePath, dotfilesTransform, forgeTransform);
    });
  }

  /**
   * Tries to open a fiddle
   *
   * @param {string} filePath
   * @memberof FileManager
   */
  public async openFiddle(filePath: string) {
    if (!filePath || typeof filePath !== 'string') return;

    console.log(`FileManager: Asked to open`, filePath);

    // We'll do our best and will likely have to
    // rewrite this once we support multiple files
    const values: EditorValues = {
      html: await this.readFile(path.join(filePath, INDEX_HTML_NAME)),
      main: await this.readFile(path.join(filePath, MAIN_JS_NAME)),
      renderer: await this.readFile(path.join(filePath, RENDERER_JS_NAME)),
    };

    appState.gistId = '';
    appState.isMyGist = false;
    appState.localPath = filePath;
    window.ElectronFiddle.app.setValues(values);
    document.title = getTitle(appState);
  }

  /**
   * Saves the current Fiddle to disk. If we never saved before,
   * we'll first open the "Save" dialog.
   *
   * @param {string} filePath
   * @memberof FileManager
   */
  public async saveFiddle(filePath: string, ...transforms: Array<FileTransform>) {
    const { localPath } = appState;
    const pathToSave = filePath || localPath;

    console.log(`FileManager: Asked to save to ${pathToSave}`);

    if (!pathToSave) {
      ipcRendererManager.send(IpcEvents.FS_SAVE_FIDDLE_DIALOG);
    } else {
      const files = await this.getFiles(undefined, ...transforms);

      for (const [ fileName, content ] of files) {
        try {
          await this.saveFile(path.join(pathToSave, fileName), content);
        } catch (error) {
          console.warn(`FileManager: Failed to save file`, { fileName, error });
        }
      }

      // Show in folder
      shell.showItemInFolder(pathToSave);

      if (pathToSave !== localPath) {
        appState.localPath = pathToSave;
      }
    }
  }


  /**
   * Get files to save, but with a transform applied
   *
   * @param {PackageJsonOptions} [options]
   * @param {...Array<FileTransform>} transforms
   * @returns {Promise<Files>}
   * @memberof FileManager
   */
  public async getFiles(options?: PackageJsonOptions, ...transforms: Array<FileTransform>): Promise<Files> {
    const pOptions = typeof options === 'object' ? options : DEFAULT_OPTIONS;
    const values = await window.ElectronFiddle.app.getValues(pOptions);
    let output: Files = new Map();

    output.set(RENDERER_JS_NAME, values.renderer);
    output.set(MAIN_JS_NAME, values.main);
    output.set(INDEX_HTML_NAME, values.html);
    output.set(PACKAGE_NAME, values.package!);

    for (const transform of transforms) {
      try {
        console.log(`getFiles: Applying ${transform.name}`);
        output = await transform(output);
      } catch (error) {
        console.warn(`getFiles: Failed to apply transform`, { transform, error });
      }
    }

    return output;
  }

  /**
   * Save the current project to a temporary directory. Returns the
   * path to the temp directory.
   *
   * @param {AppState} appState
   * @param {...Array<FileTransform>} transforms
   * @returns {Promise<string>}
   */
  public async saveToTemp(
    options: PackageJsonOptions, ...transforms: Array<FileTransform>
  ): Promise<string> {
    const fs = await fancyImport<typeof fsType>('fs-extra');
    const tmp = await import('tmp');
    const files = await this.getFiles(options, ...transforms);
    const dir = tmp.dirSync();

    tmp.setGracefulCleanup();

    for (const [ name, content ] of files) {
      await fs.writeFile(path.join(dir.name, name), content);
    }

    return dir.name;
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
      const fs = await fancyImport<typeof fsType>('fs-extra');
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
      const fs = await fancyImport<typeof fsType>('fs-extra');
      return await fs.outputFile(filePath, content, { encoding: 'utf-8' });
    } catch (error) {
      console.log(`FileManager: Could not save ${filePath}`, error);
      ipcRendererManager.send(IpcEvents.FS_SAVE_FIDDLE_ERROR, [ filePath ]);
    }
  }
}
