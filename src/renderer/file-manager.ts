import * as path from 'node:path';

import * as fs from 'fs-extra';
import semver from 'semver';

import { AppState } from './state';
import { dotfilesTransform } from './transforms/dotfiles';
import { forgeTransform } from './transforms/forge';
import { isKnownFile } from './utils/editor-utils';
import { DEFAULT_OPTIONS, PackageJsonOptions } from './utils/get-package';
import {
  EditorId,
  EditorValues,
  FileTransform,
  FileTransformOperation,
  Files,
  GenericDialogType,
  PACKAGE_NAME,
} from '../interfaces';

export class FileManager {
  constructor(private readonly appState: AppState) {
    this.openFiddle = this.openFiddle.bind(this);
    this.saveFiddle = this.saveFiddle.bind(this);

    window.ElectronFiddle.removeAllListeners('open-fiddle');
    window.ElectronFiddle.removeAllListeners('open-template');
    window.ElectronFiddle.removeAllListeners('save-fiddle');
    window.ElectronFiddle.removeAllListeners('save-fiddle-forge');

    window.ElectronFiddle.addEventListener('open-fiddle', (filePath, files) => {
      this.openFiddle(filePath, files);
    });

    window.ElectronFiddle.addEventListener(
      'open-template',
      (templateName, editorValues) => {
        window.ElectronFiddle.app.replaceFiddle(editorValues, {
          templateName,
        });
      },
    );

    window.ElectronFiddle.addEventListener('save-fiddle', (filePath) => {
      this.saveFiddle(filePath, ['dotfiles']);
    });

    window.ElectronFiddle.addEventListener('save-fiddle-forge', (filePath) => {
      this.saveFiddle(filePath, ['dotfiles', 'forge']);
    });
  }

  /**
   * Tries to open a fiddle.
   *
   * @param {string} filePath
   * @param {Record<string, string>} files
   * @memberof FileManager
   */
  public async openFiddle(filePath: string, files: Record<string, string>) {
    const { app } = window.ElectronFiddle;

    console.log(`FileManager: Asked to open`, filePath);
    if (!filePath || typeof filePath !== 'string') return;

    const editorValues: EditorValues = {};
    for (const [name, value] of Object.entries(files)) {
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
            await this.appState.showGenericDialog({
              label: `The Electron version (${version}) in this Fiddle's package.json is invalid. Falling back to last used version.`,
              ok: 'Close',
              type: GenericDialogType.warning,
              wantsInput: false,
            });
          } else {
            remoteLoader.setElectronVersion(version);
          }

          // We want to include all dependencies except Electron.
          delete deps[dep];
        }

        this.appState.modules = new Map(Object.entries(deps));
        continue;
      }

      if (isKnownFile(name) || (await app.remoteLoader.confirmAddFile(name))) {
        editorValues[name as EditorId] = value;
      }
    }

    app.replaceFiddle(editorValues, { localFiddle: { filePath, files } });
  }

  /**
   * Saves the current Fiddle to disk. If we never saved before,
   * we'll first open the "Save" dialog.
   *
   * @param {string} [filePath]
   * @param {Array<FileTransformOperation>} [transforms]
   * @memberof FileManager
   */
  public async saveFiddle(
    filePath?: string,
    transforms?: Array<FileTransformOperation>,
  ) {
    const { localPath } = this.appState;
    const pathToSave = filePath || localPath;

    console.log(`FileManager: Asked to save to ${pathToSave}`);

    if (!pathToSave) {
      window.ElectronFiddle.showSaveDialog();
    } else {
      const { files } = await this.getFiles(undefined, transforms);

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
      window.ElectronFiddle.setShowMeTemplate();
      this.appState.editorMosaic.isEdited = false;
    }
  }

  /**
   * Get files to save, but with a transform applied
   *
   * @param {PackageJsonOptions} [options]
   * @param {Array<FileTransformOperation>} [transforms]
   * @returns {Promise<{ localPath: string; files: Files }>}
   * @memberof FileManager
   */
  public async getFiles(
    options?: PackageJsonOptions,
    transforms: Array<FileTransformOperation> = [],
  ): Promise<{ localPath?: string; files: Files }> {
    const { app } = window.ElectronFiddle;

    const pOptions = typeof options === 'object' ? options : DEFAULT_OPTIONS;
    const values = await app.getEditorValues(pOptions);

    let output: Files = new Map(Object.entries(values));

    output.set(PACKAGE_NAME, values[PACKAGE_NAME as EditorId]!);

    const transformers: Record<FileTransformOperation, FileTransform> = {
      dotfiles: dotfilesTransform,
      forge: forgeTransform,
    } as const;

    for (const transform of transforms.map(
      (operation: FileTransformOperation) => transformers[operation],
    )) {
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

    return { localPath: app.state.localPath, files: output };
  }

  /**
   * Save the current project to a temporary directory. Returns the
   * path to the temp directory.
   *
   * @param {PackageJsonOptions} options
   * @param {Array<FileTransformOperation>} [transforms]
   * @returns {Promise<string>}
   */
  public async saveToTemp(
    options: PackageJsonOptions,
    transforms?: Array<FileTransformOperation>,
  ): Promise<string> {
    const tmp = await import('tmp');
    const { files } = await this.getFiles(options, transforms);
    const dir = tmp.dirSync({
      prefix: 'electron-fiddle',
    });

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
    }
  }
}
