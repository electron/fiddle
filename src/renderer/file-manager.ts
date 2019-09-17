import * as fsType from 'fs-extra';
import * as path from 'path';

import { EditorValues, Files, FileTransform } from '../interfaces';
import { IpcEvents } from '../ipc-events';
import { INDEX_HTML_NAME, MAIN_JS_NAME, PACKAGE_NAME, PRELOAD_JS_NAME, RENDERER_JS_NAME } from '../shared-constants';
import { DEFAULT_OPTIONS, PackageJsonOptions } from '../utils/get-package';
import { fancyImport } from '../utils/import';
import { ipcRendererManager } from './ipc';
import { AppState } from './state';
import { getTemplateValues } from './templates';
import { dotfilesTransform } from './transforms/dotfiles';
import { forgeTransform } from './transforms/forge';

export class FileManager {
  constructor(private readonly appState: AppState) {
    this.openFiddle = this.openFiddle.bind(this);
    this.saveFiddle = this.saveFiddle.bind(this);

    ipcRendererManager.on(IpcEvents.FS_OPEN_FIDDLE, (_event, filePath) => {
      this.openFiddle(filePath);
    });

    ipcRendererManager.on(IpcEvents.FS_OPEN_TEMPLATE, (_event, name) => {
      this.openTemplate(name);
    });

    ipcRendererManager.on(IpcEvents.FS_SAVE_FIDDLE, (_event, filePath) => {
      this.saveFiddle(filePath, dotfilesTransform);
    });

    ipcRendererManager.on(IpcEvents.FS_SAVE_FIDDLE_FORGE, (_event, filePath) => {
      this.saveFiddle(filePath, dotfilesTransform, forgeTransform);
    });
  }

  /**
   * Opens a template.
   *
   * @param {string} templateName
   * @memberof FileManager
   */
  public async openTemplate(templateName: string) {
    const editorValues = await getTemplateValues(templateName);
    await window.ElectronFiddle.app.replaceFiddle(editorValues, {templateName});
  }

  /**
   * Tries to open a fiddle.
   *
   * @param {string} filePath
   * @memberof FileManager
   */
  public async openFiddle(filePath: string) {
    if (!filePath || typeof filePath !== 'string') return;

    console.log(`FileManager: Asked to open`, filePath);

    // We'll do our best and will likely have to
    // rewrite this once we support multiple files
    const editorValues: EditorValues = {
      html: await this.readFile(path.join(filePath, INDEX_HTML_NAME)),
      main: await this.readFile(path.join(filePath, MAIN_JS_NAME)),
      renderer: await this.readFile(path.join(filePath, RENDERER_JS_NAME)),
      preload: await this.readFile(path.join(filePath, PRELOAD_JS_NAME)),
    };


    window.ElectronFiddle.app.replaceFiddle(editorValues, {filePath});
  }

  /**
   * Saves the current Fiddle to disk. If we never saved before,
   * we'll first open the "Save" dialog.
   *
   * @param {string} filePath
   * @memberof FileManager
   */
  public async saveFiddle(filePath?: string, ...transforms: Array<FileTransform>) {
    const { localPath } = this.appState;
    const pathToSave = filePath || localPath;

    console.log(`FileManager: Asked to save to ${pathToSave}`);

    if (!pathToSave) {
      ipcRendererManager.send(IpcEvents.FS_SAVE_FIDDLE_DIALOG);
    } else {
      const files = await this.getFiles(undefined, ...transforms);

      for (const [fileName, content] of files) {
        const savePath = path.join(pathToSave, fileName);

        // If the file has content, save it to disk. If there's no
        // content in the file, remove a file that possibly exists.
        if (content) {
          await this.saveFile(savePath, content);
        } else {
          await this.removeFile(savePath);
        }
      }

      if (pathToSave !== localPath) {
        this.appState.localPath = pathToSave;
      }

      this.appState.isUnsaved = false;
      window.ElectronFiddle.app.setupUnsavedOnChangeListener();
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
    const values = await window.ElectronFiddle.app.getEditorValues(pOptions);
    let output: Files = new Map();

    output.set(RENDERER_JS_NAME, values.renderer);
    output.set(MAIN_JS_NAME, values.main);
    output.set(INDEX_HTML_NAME, values.html);
    output.set(PRELOAD_JS_NAME, values.preload);
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
   * Attempts to clean a given directory. Used to manually
   * clean temp directories.
   *
   * @param {string} dir
   */
  public async cleanup(dir?: string): Promise<boolean> {
    if (dir) {
      const fs = await fancyImport<typeof fsType>('fs-extra');

      if (fs.existsSync(dir)) {
        try {
          await fs.remove(dir);
          return true;
        } catch (error) {
          console.warn(`cleanup: Failed to clean directory`, error);
        }
      }
    }

    return false;
  }

  /**
   * Save the current project to a temporary directory. Returns the
   * path to the temp directory.
   *
   * @param {PackageJsonOptions} options
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

    for (const [name, content] of files) {
      try {
        await fs.outputFile(path.join(dir.name, name), content);
      } catch (error) {
        throw error;
      }
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
      ipcRendererManager.send(IpcEvents.FS_SAVE_FIDDLE_ERROR, [filePath]);
    }
  }

  /**
   * Safely attempts to remove a file, doesn't crash the app if
   * it fails.
   *
   * @param {string} filePath
   * @returns {string}
   * @memberof FileManager
   */
  private async removeFile(filePath: string): Promise<void> {
    try {
      const fs = await fancyImport<typeof fsType>('fs-extra');
      return await fs.remove(filePath);
    } catch (error) {
      console.log(`FileManager: Could not remove ${filePath}`, error);
      ipcRendererManager.send(IpcEvents.FS_SAVE_FIDDLE_ERROR, [filePath]);
    }
  }
}
