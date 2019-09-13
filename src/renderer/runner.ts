import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';

import { EditorValues, FileTransform } from '../interfaces';
import { IpcEvents } from '../ipc-events';
import { getAppDataDir } from '../utils/app-data-dir';
import { PackageJsonOptions } from '../utils/get-package';
import { maybePlural } from '../utils/plural-maybe';
import { ipcRendererManager } from './ipc';
import { findModulesInEditors, getIsNpmInstalled, installModules, npmRun } from './npm';
import { AppState } from './state';

export enum ForgeCommands {
  PACKAGE = 'package',
  MAKE = 'make'
}

export class Runner {
  public child: ChildProcess | null = null;

  constructor(private readonly appState: AppState) {
    this.run = this.run.bind(this);
    this.stop = this.stop.bind(this);

    ipcRendererManager.on(IpcEvents.FIDDLE_RUN, this.run);
    ipcRendererManager.on(IpcEvents.FIDDLE_PACKAGE, () => {
      this.performForgeOperation(ForgeCommands.PACKAGE);
    });
    ipcRendererManager.on(IpcEvents.FIDDLE_MAKE, () => {
      this.performForgeOperation(ForgeCommands.MAKE);
    });
  }

  /**
   * Actually run the fiddle.
   *
   * @returns {Promise<boolean>}
   */
  public async run(): Promise<boolean> {
    const { fileManager, getEditorValues } = window.ElectronFiddle.app;
    const options = { includeDependencies: false, includeElectron: false };
    const { binaryManager, currentElectronVersion } = this.appState;
    const { version, localPath } = currentElectronVersion;

    if (this.appState.isClearingConsoleOnRun) {
      this.appState.clearConsole();
    }
    this.appState.isConsoleShowing = true;

    const values = await getEditorValues(options);
    const dir = await this.saveToTemp(options);

    if (!dir) return false;

    try {
      await this.installModulesForEditor(values, dir);
    } catch (error) {
      console.error('Runner: Could not install modules', error);
      fileManager.cleanup(dir);
      return false;
    }

    const isReady = await binaryManager.getIsDownloaded(version, localPath);

    if (!isReady) {
      console.warn(`Runner: Binary ${version} not ready`);

      let message = `Could not start fiddle: `;
      message += `Electron ${version} not downloaded yet. `;
      message += `Please wait for it to finish downloading `;
      message += `before running the fiddle.`;

      this.appState.pushOutput(message, { isNotPre: true });
      fileManager.cleanup(dir);
      return false;
    }

    this.execute(dir);

    return true;
  }

  /**
   * Stop a currently running Electron fiddle.
   */
  public async stop() {
    if (this.child) {
      this.child.kill();
      this.appState.isRunning = false;
    }
  }

  /**
   * Uses electron-forge to either package or make the current fiddle
   *
   * @param {ForgeCommands} operation
   * @returns {Promise<boolean>}
   * @memberof Runner
   */
  public async performForgeOperation(operation: ForgeCommands): Promise<boolean> {
    const options = { includeDependencies: true, includeElectron: true };
    const { dotfilesTransform } = await import('./transforms/dotfiles');
    const { forgeTransform } = await import('./transforms/forge');
    const { pushError, pushOutput } = this.appState;

    const strings = operation === ForgeCommands.MAKE
      ? [ 'Creating installers for', 'Binary' ]
      : [ 'Packaging', 'Installers' ];

    this.appState.isConsoleShowing = true;
    pushOutput(`📦 ${strings[0]} current Fiddle...`);

    if (!(await getIsNpmInstalled())) {
      let message = `Error: Could not find npm. Fiddle requires Node.js and npm `;
      message += `to compile packages. Please visit https://nodejs.org to install `;
      message += `Node.js and npm.`;

      this.appState.pushOutput(message, { isNotPre: true });
      return false;
    }

    // Save files to temp
    const dir = await this.saveToTemp(options, dotfilesTransform, forgeTransform);
    if (!dir) return false;

    // Files are now saved to temp, let's install Forge and dependencies
    if (!(await this.npmInstall(dir))) return false;

    // Cool, let's run "package"
    try {
      console.log(`Now creating ${strings[1].toLowerCase()}...`);
      pushOutput(await npmRun({ dir }, operation));
      pushOutput(`✅ ${strings[1]} successfully created.`, { isNotPre: true });
    } catch (error) {
      pushError(`Creating ${strings[1].toLowerCase()} failed.`, error);
      return false;
    }

    const { shell } = await import('electron');
    shell.showItemInFolder(path.join(dir, 'out'));
    return true;
  }

  /**
   * Analyzes the editor's JavaScript contents for modules
   * and installs them.
   *
   * @param {EditorValues} values
   * @param {string} dir
   * @returns {Promise<void>}
   */
  public async installModulesForEditor(values: EditorValues, dir: string): Promise<void> {
    const modules = await findModulesInEditors(values);
    const { pushOutput } = this.appState;

    if (modules && modules.length > 0) {
      if (!(await getIsNpmInstalled())) {
        let message = `The ${maybePlural(`module`, modules)} ${modules.join(', ')} need to be installed, `;
        message += `but we could not find npm. Fiddle requires Node.js and npm `;
        message += `to support the installation of modules not included in `;
        message += `Electron. Please visit https://nodejs.org to install Node.js `;
        message += `and npm.`;

        pushOutput(message, { isNotPre: true });
        return;
      }

      pushOutput(`Installing npm modules: ${modules.join(', ')}...`, { isNotPre: true });
      pushOutput(await installModules({ dir }, ...modules));
    }
  }

  /**
   * Execute Electron.
   *
   * @param {string} dir
   * @param {string} version
   * @returns {Promise<void>}
   * @memberof Runner
   */
  public async execute(dir: string): Promise<void> {
    const { currentElectronVersion, pushOutput, binaryManager } = this.appState;
    const { version, localPath } = currentElectronVersion;
    const binaryPath = binaryManager.getElectronBinaryPath(version, localPath);
    console.log(`Runner: Binary ${binaryPath} ready, launching`);

    const env = { ...process.env };
    if (this.appState.isEnablingElectronLogging) {
      env.ELECTRON_ENABLE_LOGGING = 'true';
      env.ELECTRON_ENABLE_STACK_DUMPING = 'true';
    } else {
      delete env.ELECTRON_ENABLE_LOGGING;
      delete env.ELECTRON_ENABLE_STACK_DUMPING;
    }

    this.child = spawn(binaryPath, [ dir, '--inspect' ], {
      cwd: dir,
      env,
    });
    this.appState.isRunning = true;
    pushOutput(`Electron v${version} started.`);

    this.child.stdout!.on('data', (data) => pushOutput(data, { bypassBuffer: false }));
    this.child.stderr!.on('data', (data) => pushOutput(data, { bypassBuffer: false }));
    this.child.on('close', async (code) => {
      const withCode = typeof code === 'number'
        ? ` with code ${code.toString()}.`
        : `.`;

      pushOutput(`Electron exited${withCode}`);
      this.appState.isRunning = false;
      this.child = null;

      // Clean older folders
      await window.ElectronFiddle.app.fileManager.cleanup(dir);
      await this.deleteUserData();
    });
  }

  /**
   * Save files to temp, logging to the Fiddle terminal while doing so
   *
   * @param {PackageJsonOptions} options
   * @param {...Array<FileTransform>} transforms
   * @returns {(Promise<string | null>)}
   * @memberof Runner
   */
  public async saveToTemp(
    options: PackageJsonOptions, ...transforms: Array<FileTransform>
  ): Promise<string | null> {
    const { fileManager } = window.ElectronFiddle.app;
    const { pushOutput, pushError } = this.appState;

    try {
      pushOutput(`Saving files to temp directory...`);
      const dir = await fileManager.saveToTemp(options, ...transforms);
      pushOutput(`Saved files to ${dir}`);
      return dir;
    } catch (error) {
      pushError('Failed to save files.', error);
    }

    return null;
  }

  /**
   * Installs modules in a given directory (we're basically
   * just running "npm install")
   *
   * @param {string} dir
   * @returns
   * @memberof Runner
   */
  public async npmInstall(dir: string): Promise<boolean> {
    try {
      this.appState.pushOutput(`Now running "npm install..."`);
      this.appState.pushOutput(await installModules({ dir }));
      return true;
    } catch (error) {
      this.appState.pushError('Failed to run "npm install".', error);
    }

    return false;
  }

  /**
   * Deletes the user data dir after a run.
   */
  private async deleteUserData() {
    if (this.appState.isKeepingUserDataDirs) {
      console.log(`Cleanup: Not deleting data dir due to isKeepingUserDataDirs setting`);
      return;
    }

    const name = await this.appState.getName();
    const appData = getAppDataDir(name);

    console.log(`Cleanup: Deleting data dir ${appData}`);
    await window.ElectronFiddle.app.fileManager.cleanup(appData);
  }
}
