import semver from 'semver';

import { AppState } from './state';
import { dotfilesTransform } from './transforms/dotfiles';
import { forgeTransform } from './transforms/forge';
import { isKnownFile } from './utils/editor-utils';
import { DEFAULT_OPTIONS } from './utils/get-package';
import {
  EditorId,
  EditorValues,
  FileTransform,
  FileTransformOperation,
  Files,
  GenericDialogType,
  PACKAGE_NAME,
  PackageJsonOptions,
} from '../interfaces';

export class FileManager {
  constructor(private readonly appState: AppState) {
    this.getFiles = this.getFiles.bind(this);
    this.openFiddle = this.openFiddle.bind(this);

    window.ElectronFiddle.removeAllListeners('open-fiddle');
    window.ElectronFiddle.removeAllListeners('open-template');
    window.ElectronFiddle.removeAllListeners('saved-local-fiddle');

    window.ElectronFiddle.addEventListener('open-fiddle', (filePath, files) => {
      this.openFiddle(filePath, files);
    });

    window.ElectronFiddle.addEventListener(
      'open-template',
      (templateName, editorValues) => {
        window.app.replaceFiddle(editorValues, {
          templateName,
        });
      },
    );

    window.ElectronFiddle.addEventListener('saved-local-fiddle', (filePath) => {
      const { localPath } = this.appState;

      if (filePath !== localPath) {
        this.appState.localPath = filePath;
        this.appState.gistId = undefined;
      }
      window.ElectronFiddle.setShowMeTemplate();
      this.appState.templateName = undefined;
      this.appState.editorMosaic.isEdited = false;
    });

    window.ElectronFiddle.onGetFiles(this.getFiles);
  }

  /**
   * Tries to open a fiddle.
   */
  public async openFiddle(filePath: string, files: Record<string, string>) {
    const { app } = window;

    console.log(`FileManager: Asked to open`, filePath);
    if (!filePath || typeof filePath !== 'string') return;

    const editorValues: EditorValues = {};
    for (const [name, value] of Object.entries(files)) {
      if (name === PACKAGE_NAME) {
        const { remoteLoader } = window.app;

        const deps: Record<string, string> = {};
        try {
          const { dependencies, devDependencies } = JSON.parse(value);
          Object.assign(deps, dependencies, devDependencies);
        } catch {
          await this.appState.showErrorDialog(
            'Could not open Fiddle - invalid JSON found in package.json',
          );
        }

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
   * Get files to save, but with a transform applied
   */
  public async getFiles(
    options?: PackageJsonOptions,
    transforms: Array<FileTransformOperation> = [],
  ): Promise<{ localPath?: string; files: Files }> {
    const { app } = window;

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
        output = await transform(output, app.state.currentElectronVersion);
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
   */
  public async saveToTemp(
    options: PackageJsonOptions,
    transforms?: Array<FileTransformOperation>,
  ): Promise<string> {
    const { files } = await this.getFiles(options, transforms);
    return window.ElectronFiddle.saveFilesToTemp(files);
  }
}
