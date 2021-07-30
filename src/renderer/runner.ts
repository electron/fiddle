import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import isRunning from 'is-running';

import {
  EditorValues,
  FileTransform,
  RunResult,
  RunnableVersion,
} from '../interfaces';
import { IpcEvents } from '../ipc-events';
import { PackageJsonOptions } from '../utils/get-package';
import { maybePlural } from '../utils/plural-maybe';
import { getElectronBinaryPath, getIsDownloaded } from './binary';
import { Bisector } from './bisect';
import { ipcRendererManager } from './ipc';
import {
  findModulesInEditors,
  getIsPackageManagerInstalled,
  installModules,
  packageRun,
  PMOperationOptions,
} from './npm';
import { AppState } from './state';

export enum ForgeCommands {
  PACKAGE = 'package',
  MAKE = 'make',
}

const resultString: Record<RunResult, string> = Object.freeze({
  [RunResult.FAILURE]: '❌ failed',
  [RunResult.INVALID]: '❓ invalid',
  [RunResult.SUCCESS]: '✅ passed',
});

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
   * Bisect the current fiddle across the specified versions.
   *
   * @param {Array<RunnableVersion>} versions - versions to bisect
   * @returns {Promise<RunResult>}
   * @memberof Runner
   */
  public autobisect(versions: Array<RunnableVersion>): Promise<RunResult> {
    const { appState } = this;
    appState.isAutoBisecting = true;
    const done = () => (appState.isAutoBisecting = false);
    return this.autobisectImpl(versions).finally(done);
  }

  /**
   * Bisect the current fiddle across the specified versions.
   *
   * @param {Array<RunnableVersion>} versions - versions to bisect
   * @returns {Promise<RunResult>}
   * @memberof Runner
   */
  public async autobisectImpl(
    versions: Array<RunnableVersion>,
  ): Promise<RunResult> {
    const prefix = `Runner: autobisect`;
    const { appState } = this;

    // precondition: can't bisect unless we have >= 2 versions
    if (versions.length < 2) {
      appState.pushOutput(`${prefix} needs at least two Electron versions`);
      return RunResult.INVALID;
    }

    const results: Map<string, RunResult> = new Map();

    const runVersion = async (version: string) => {
      let result = results.get(version);
      if (result === undefined) {
        const pre = `${prefix} Electron ${version} -`;
        appState.pushOutput(`${pre} setting version`);
        await appState.setVersion(version);
        appState.pushOutput(`${pre} starting test`);
        result = await this.run();
        results.set(version, result);
        appState.pushOutput(`${pre} finished test ${resultString[result]}`);
      }
      return result;
    };

    const bisector = new Bisector(versions);
    let targetVersion = bisector.getCurrentVersion();
    let next;
    while (true) {
      const { version } = targetVersion;

      const result = await runVersion(version);
      if (result === RunResult.INVALID) {
        return result;
      }

      next = bisector.continue(result === RunResult.SUCCESS);
      if (Array.isArray(next)) {
        break;
      }

      targetVersion = next;
    }

    const [good, bad] = next.map((v) => v.version);
    const resultGood = await runVersion(good);
    const resultBad = await runVersion(bad);
    if (resultGood === resultBad) {
      appState.pushOutput(
        `${prefix} 'good' ${good} and 'bad' ${bad} both returned ${resultString[resultGood]}`,
      );
      return RunResult.INVALID;
    }

    const msgs = [
      `${prefix} complete`,
      `${prefix} ${resultString[RunResult.SUCCESS]} ${good}`,
      `${prefix} ${resultString[RunResult.FAILURE]} ${bad}`,
      `${prefix} Commits between versions:`,
      `https://github.com/electron/electron/compare/v${good}...v${bad}`,
    ];
    msgs.forEach((msg) => appState.pushOutput(msg));
    return RunResult.SUCCESS;
  }

  /**
   * Actually run the fiddle.
   *
   * @returns {Promise<RunResult>}
   */
  public async run(): Promise<RunResult> {
    const { fileManager, getEditorValues } = window.ElectronFiddle.app;
    const options = { includeDependencies: false, includeElectron: false };

    const { appState } = this;
    const { version, localPath } = appState.currentElectronVersion;

    if (appState.isClearingConsoleOnRun) {
      appState.clearConsole();
    }
    appState.isConsoleShowing = true;

    const values = await getEditorValues(options);
    const dir = await this.saveToTemp(options);
    const packageManager = appState.packageManager;

    if (!dir) return RunResult.INVALID;

    try {
      await this.installModulesForEditor(values, { dir, packageManager });
    } catch (error) {
      console.error('Runner: Could not install modules', error);

      appState.pushError('Could not install modules', error.message);
      appState.isInstallingModules = false;

      fileManager.cleanup(dir);
      return RunResult.INVALID;
    }

    const isReady = getIsDownloaded(version, localPath);

    if (!isReady) {
      console.warn(`Runner: Binary ${version} not ready`);

      let message = `Could not start fiddle: `;
      message += `Electron ${version} not downloaded yet. `;
      message += `Please wait for it to finish downloading `;
      message += `before running the fiddle.`;

      appState.pushOutput(message, { isNotPre: true });
      fileManager.cleanup(dir);
      return RunResult.INVALID;
    }

    return this.execute(dir);
  }

  /**
   * Stop a currently running Electron fiddle.
   *
   * @returns {boolean} true if runner is now idle
   * @memberof Runner
   */
  public stop(): void {
    this.appState.isRunning = !!this.child && !this.child.kill();

    // If the child process is still alive 1 second after we've
    // attempted to kill it by normal means, kill it forcefully.
    setTimeout(() => {
      const pid = this.child?.pid;
      if (pid && isRunning(pid)) {
        this.child?.kill('SIGKILL');
      }
    }, 1000);
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

      const result = await installModules(pmOptions, ...modules);
      pushOutput(result);

      this.appState.isInstallingModules = false;
    }
  }

  private buildChildEnvVars(): { [x: string]: string | undefined } {
    const { isEnablingElectronLogging, environmentVariables } = this.appState;

    const env = { ...process.env };

    if (isEnablingElectronLogging) {
      env.ELECTRON_ENABLE_LOGGING = 'true';
      env.ELECTRON_DEBUG_NOTIFICATIONS = 'true';
      env.ELECTRON_ENABLE_STACK_DUMPING = 'true';
    } else {
      delete env.ELECTRON_ENABLE_LOGGING;
      delete env.ELECTRON_DEBUG_NOTIFICATIONS;
      delete env.ELECTRON_ENABLE_STACK_DUMPING;
    }

    for (const v of environmentVariables) {
      const [key, value] = v.split('=');
      env[key] = value;
    }

    return env;
  }

  /**
   * Execute Electron.
   *
   * @param {string} dir
   * @param {string} version
   * @returns {Promise<void>}
   * @memberof Runner
   */
  public async execute(dir: string): Promise<RunResult> {
    const {
      currentElectronVersion,
      flushOutput,
      pushOutput,
      executionFlags,
    } = this.appState;

    const { version, localPath } = currentElectronVersion;
    const binaryPath = getElectronBinaryPath(version, localPath);
    console.log(`Runner: Binary ${binaryPath} ready, launching`);

    const env = this.buildChildEnvVars();

    // Add user-specified cli flags if any have been set.
    const options = [dir, '--inspect'].concat(executionFlags);

    return new Promise((resolve, _reject) => {
      this.child = spawn(binaryPath, options, { cwd: dir, env });
      this.appState.isRunning = true;
      pushOutput(`Electron v${version} started.`);

      this.child.stdout!.on('data', (data) =>
        pushOutput(data, { bypassBuffer: false }),
      );
      this.child.stderr!.on('data', (data) =>
        pushOutput(data, { bypassBuffer: false }),
      );
      this.child.on('close', async (code, signal) => {
        flushOutput();

        this.appState.isRunning = false;
        this.child = null;

        // Clean older folders
        await window.ElectronFiddle.app.fileManager.cleanup(dir);
        await this.deleteUserData();

        if (typeof code !== 'number') {
          pushOutput(`Electron exited with signal ${signal}.`);
          resolve(RunResult.INVALID);
        } else {
          pushOutput(`Electron exited with code ${code}.`);
          resolve(!code ? RunResult.SUCCESS : RunResult.FAILURE);
        }
      });
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
    const appData = path.join(window.ElectronFiddle.appPaths.appData, name);

    console.log(`Cleanup: Deleting data dir ${appData}`);
    await window.ElectronFiddle.app.fileManager.cleanup(appData);
  }
}
