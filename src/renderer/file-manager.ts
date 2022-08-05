import * as path from 'path';

import * as fs from 'fs-extra';
import semver from 'semver';

import { FileTransform, Files, PACKAGE_NAME } from '../interfaces';
import { IpcEvents } from '../ipc-events';
import { isKnownFile } from '../utils/editor-utils';
import { DEFAULT_OPTIONS, PackageJsonOptions } from '../utils/get-package';
import { readFiddle } from '../utils/read-fiddle';
import { ipcRendererManager } from './ipc';
import { AppState } from './state';
import { getTemplateValues } from './templates';
import { dotfilesTransform } from './transforms/dotfiles';
import { forgeTransform } from './transforms/forge';

export class FileManager {
  constructor(private readonly appState: AppState) {
    this.openFiddle = this.openFiddle.bind(this);
    this.saveFiddle = this.saveFiddle.bind(this);

    ipcRendererManager.removeAllListeners(IpcEvents.FS_OPEN_FIDDLE);
    ipcRendererManager.removeAllListeners(IpcEvents.FS_OPEN_TEMPLATE);
    ipcRendererManager.removeAllListeners(IpcEvents.FS_SAVE_FIDDLE);
    ipcRendererManager.removeAllListeners(IpcEvents.FS_SAVE_FIDDLE_FORGE);

    ipcRendererManager.on(IpcEvents.FS_OPEN_FIDDLE, (_event, filePath) => {
      this.openFiddle(filePath);
    });

    ipcRendererManager.on(IpcEvents.FS_OPEN_TEMPLATE, (_event, name) => {
      this.openTemplate(name);
    });

    ipcRendererManager.on(IpcEvents.FS_SAVE_FIDDLE, (_event, filePath) => {
      this.saveFiddle(filePath, dotfilesTransform);
    });

    ipcRendererManager.on(
      IpcEvents.FS_SAVE_FIDDLE_FORGE,
      (_event, filePath) => {
        this.saveFiddle(filePath, dotfilesTransform, forgeTransform);
      },
    );
  }

  /**
   * Opens a template.
   *
   * @param {string} templateName
   * @memberof FileManager
   */
  public async openTemplate(templateName: string) {
    const editorValues = await getTemplateValues(templateName);
    await window.ElectronFiddle.app.replaceFiddle(editorValues, {
      templateName,
    });
  }

  /**
   * Tries to open a fiddle.
   *
   * @param {string} filePath
   * @memberof FileManager
   */
  public async openFiddle(filePath: string) {
    const { app } = window.ElectronFiddle;

    console.log(`FileManager: Asked to open`, filePath);
    if (!filePath || typeof filePath !== 'string') return;

    const editorValues = {};
    const files: [string, string][] = Object.entries(
      await readFiddle(filePath, true),
    );
    for (const [name, value] of files) {
      if (name === PACKAGE_NAME) {
        const { remoteLoader } = window.ElectronFiddle.app;
        const { dependencies, devDependencies } = JSON.parse(value);
        const deps: Record<string, string> = {
          ...dependencies,
          ...devDependencies,
        };

        // If the project specifies an Electron version, we want to tell Fiddle to run
        // it with that version by default.
        const electronDeps = Object.keys(deps).filter((d) =>
          ['electron-nightly', 'electron'].includes(d),
        );
        for (const dep of electronDeps) {
          // Strip off semver range prefixes, e.g:
          // ^1.2.0 -> 1.2.0
          // ~2.3.4 -> 2.3.4
          const index = deps[dep].search(/\d/);
          const version = deps[dep].substring(index);

          if (!semver.valid(version)) {
            throw new Error(
              "This Fiddle's package.json contains an invalid Electron version.",
            );
          }

          // We want to include all dependencies except Electron.
          remoteLoader.setElectronVersion(version);

          delete deps[dep];
        }

        this.appState.modules = new Map(Object.entries(deps));
        continue;
      }

      if (isKnownFile(name) || (await app.remoteLoader.confirmAddFile(name))) {
        editorValues[name] = value;
      }
    }

    app.replaceFiddle(editorValues, { filePath });
  }

  /**
   * Saves the current Fiddle to disk. If we never saved before,
   * we'll first open the "Save" dialog.
   *
   * @param {string} [filePath]
   * @param {...Array<FileTransform>} transforms
   * @memberof FileManager
   */
  public async saveFiddle(
    filePath?: string,
    ...transforms: Array<FileTransform>
  ) {
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
          this.appState.templateName = undefined;
        } else {
          await this.removeFile(savePath);
        }
      }

      if (pathToSave !== localPath) {
        this.appState.localPath = pathToSave;
        this.appState.gistId = undefined;
      }
      ipcRendererManager.send(IpcEvents.SET_SHOW_ME_TEMPLATE);
      this.appState.editorMosaic.isEdited = false;
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
  public async getFiles(
    options?: PackageJsonOptions,
    ...transforms: Array<FileTransform>
  ): Promise<Files> {
    const { app } = window.ElectronFiddle;

    const pOptions = typeof options === 'object' ? options : DEFAULT_OPTIONS;
    const values = await app.getEditorValues(pOptions);

    let output: Files = new Map(Object.entries(values));

    output.set(PACKAGE_NAME, values[PACKAGE_NAME]!);

    for (const transform of transforms) {
      try {
        console.log(`getFiles: Applying ${transform.name}`);
        output = await transform(output);
      } catch (error) {
        console.warn(`getFiles: Failed to apply transform`, {
          transform,
          error,
        });
      }
    }

    return output;
  }

  /**
   * Attempts to clean a given directory. Used to manually
   * clean temp directories.
   *
   * @param {string} [dir]
   */
  public async cleanup(dir?: string): Promise<boolean> {
    if (dir) {
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
    options: PackageJsonOptions,
    ...transforms: Array<FileTransform>
  ): Promise<string> {
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
   * Safely attempts to save a file, doesn't crash the app if
   * it fails.
   *
   * @param {string} filePath
   * @param {string} content
   * @returns {Promise<void>}
   * @memberof FileManager
   */
  private async saveFile(filePath: string, content: string): Promise<void> {
    try {
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
   * @returns {Promise<void>}
   * @memberof FileManager
   */
  private async removeFile(filePath: string): Promise<void> {
    try {
      return await fs.remove(filePath);
    } catch (error) {
      console.log(`FileManager: Could not remove ${filePath}`, error);
      ipcRendererManager.send(IpcEvents.FS_SAVE_FIDDLE_ERROR, [filePath]);
    }
  }
}
