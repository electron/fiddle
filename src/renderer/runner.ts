import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';

import * as jestCLI from 'jest-cli';
import * as jest from 'jest';

import { EditorValues, FileTransform } from '../interfaces';
import { IpcEvents } from '../ipc-events';
import { PackageJsonOptions } from '../utils/get-package';
import { maybePlural } from '../utils/plural-maybe';
import { getElectronBinaryPath, getIsDownloaded } from './binary';
import { ipcRendererManager } from './ipc';
import {
  findModulesInEditors,
  getIsPackageManagerInstalled,
  installModules,
  packageRun,
  PMOperationOptions,
} from './npm';
import { AppState } from './state';

import type { Config } from '@jest/types';


export enum ForgeCommands {
  PACKAGE = 'package',
  MAKE = 'make',
}

export class Runner {
  public child: ChildProcess | null = null;

  constructor(private readonly appState: AppState) {
    this.run = this.run.bind(this);
    this.stop = this.stop.bind(this);

    ipcRendererManager.removeAllListeners(IpcEvents.FIDDLE_RUN);
    ipcRendererManager.removeAllListeners(IpcEvents.FIDDLE_PACKAGE);
    ipcRendererManager.removeAllListeners(IpcEvents.FIDDLE_MAKE);

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
    const { currentElectronVersion } = this.appState;
    const { version, localPath } = currentElectronVersion;

    if (this.appState.isClearingConsoleOnRun) {
      this.appState.clearConsole();
    }
    this.appState.isConsoleShowing = true;

    const values = await getEditorValues(options);
    const dir = await this.saveToTemp(options);
    const packageManager = this.appState.packageManager;

    if (!dir) return false;

    try {
      await this.installModulesForEditor(values, { dir, packageManager });
    } catch (error) {
      console.error('Runner: Could not install modules', error);
      fileManager.cleanup(dir);
      return false;
    }

    const isReady = await getIsDownloaded(version, localPath);

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
  public async performForgeOperation(
    operation: ForgeCommands,
  ): Promise<boolean> {
    const options = { includeDependencies: true, includeElectron: true };
    const { dotfilesTransform } = await import('./transforms/dotfiles');
    const { forgeTransform } = await import('./transforms/forge');
    const { pushError, pushOutput } = this.appState;

    const strings =
      operation === ForgeCommands.MAKE
        ? ['Creating installers for', 'Binary']
        : ['Packaging', 'Installers'];

    this.appState.isConsoleShowing = true;
    pushOutput(`📦 ${strings[0]} current Fiddle...`);

    const packageManager = this.appState.packageManager;
    const pmInstalled = await getIsPackageManagerInstalled(packageManager);
    if (!pmInstalled) {
      let message = `Error: Could not find ${packageManager}. Fiddle requires Node.js and npm or yarn `;
      message += `to compile packages. Please visit https://nodejs.org to install `;
      message += `Node.js and npm, or https://classic.yarnpkg.com/lang/en/ `;
      message += `to install Yarn`;

      this.appState.pushOutput(message, { isNotPre: true });
      return false;
    }

    // Save files to temp
    const dir = await this.saveToTemp(
      options,
      dotfilesTransform,
      forgeTransform,
    );
    if (!dir) return false;

    // Files are now saved to temp, let's install Forge and dependencies
    if (!(await this.packageInstall({ dir, packageManager }))) return false;

    // Cool, let's run "package"
    try {
      console.log(`Now creating ${strings[1].toLowerCase()}...`);
      pushOutput(await packageRun({ dir, packageManager }, operation));
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
  public async installModulesForEditor(
    values: EditorValues,
    pmOptions: PMOperationOptions,
  ): Promise<void> {
    const modules = await findModulesInEditors(values);
    const { pushOutput } = this.appState;

    if (modules && modules.length > 0) {
      this.appState.isInstallingModules = true;
      const packageManager = pmOptions.packageManager;
      const pmInstalled = await getIsPackageManagerInstalled(packageManager);
      if (!pmInstalled) {
        let message = `The ${maybePlural(`module`, modules)} ${modules.join(
          ', ',
        )} need to be installed, `;
        message += `but we could not find ${packageManager}. Fiddle requires Node.js and npm `;
        message += `to support the installation of modules not included in `;
        message += `Electron. Please visit https://nodejs.org to install Node.js `;
        message += `and npm, or https://classic.yarnpkg.com/lang/en/ to install Yarn`;

        pushOutput(message, { isNotPre: true });
        this.appState.isInstallingModules = false;
        return;
      }

      pushOutput(
        `Installing node modules using ${
          pmOptions.packageManager
        }: ${modules.join(', ')}...`,
        { isNotPre: true },
      );
      pushOutput(await installModules(pmOptions, ...modules));
      this.appState.isInstallingModules = false;
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
    const { currentElectronVersion, pushOutput } = this.appState;
    const { version, localPath } = currentElectronVersion;
    const binaryPath = getElectronBinaryPath(version, localPath);
    console.log(`Runner: Binary ${binaryPath} ready, launching`);

    console.log(binaryPath)

    const env = { ...process.env };
    if (this.appState.isEnablingElectronLogging) {
      env.ELECTRON_ENABLE_LOGGING = 'true';
      env.ELECTRON_DEBUG_NOTIFICATIONS = 'true';
      env.ELECTRON_ENABLE_STACK_DUMPING = 'true';
    } else {
      delete env.ELECTRON_ENABLE_LOGGING;
      delete env.ELECTRON_DEBUG_NOTIFICATIONS;
      delete env.ELECTRON_ENABLE_STACK_DUMPING;
    }

    this.child = spawn('jest');

    this.child.stdout!.on('data', (data) =>
      pushOutput(data, { bypassBuffer: false }),
    );
    this.child.stderr!.on('data', (data) =>
      pushOutput(data, { bypassBuffer: false }),
    );
    // console.log(result);

    // Add user-specified cli flags if any have been set.
    // const options = [dir, '--inspect'].concat(this.appState.executionFlags);

    // this.child = spawn(binaryPath, options, { cwd: dir, env });
    // this.appState.isRunning = true;
    // pushOutput(`Electron v${version} started.`);

    // this.child.stdout!.on('data', (data) =>
    //   pushOutput(data, { bypassBuffer: false }),
    // );
    // this.child.stderr!.on('data', (data) =>
    //   pushOutput(data, { bypassBuffer: false }),
    // );
    // this.child.on('close', async (code) => {
    //   const withCode =
    //     typeof code === 'number' ? ` with code ${code.toString()}.` : `.`;

    //   pushOutput(`Electron exited${withCode}`);
    //   this.appState.isRunning = false;
    //   this.child = null;

    //   // Clean older folders
    //   await window.ElectronFiddle.app.fileManager.cleanup(dir);
    //   await this.deleteUserData();
    // });
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
    options: PackageJsonOptions,
    ...transforms: Array<FileTransform>
  ): Promise<string | null> {
    const { fileManager } = window.ElectronFiddle.app;
    const { pushOutput, pushError } = this.appState;

    try {
      pushOutput(`Saving files to temp directory...`);
      const dir = await fileManager.saveToTemp(options, ...transforms);
      pushOutput(`Saved files to ${dir}`);
      return dir;
    } catch (error) {
      pushError('Failed to save files.', error.message);
    }

    return null;
  }

  /**
   * Installs modules in a given directory (we're basically
   * just running "{packageManager} install")
   *
   * @param {PMOperationOptions} options
   * @returns
   * @memberof Runner
   */
  public async packageInstall(options: PMOperationOptions): Promise<boolean> {
    try {
      this.appState.pushOutput(`Now running "npm install..."`);
      this.appState.pushOutput(await installModules(options));
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
      console.log(
        `Cleanup: Not deleting data dir due to isKeepingUserDataDirs setting`,
      );
      return;
    }

    const name = await this.appState.getName();
    const appData = path.join(this.appState.appData, name);

    console.log(`Cleanup: Deleting data dir ${appData}`);
    await window.ElectronFiddle.app.fileManager.cleanup(appData);
  }
}
