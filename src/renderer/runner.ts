import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';

import { getVersionRange } from '../utils/get-version-range';
import { EditorValues, FileTransform, RunResult, RunnableVersion, VersionState } from '../interfaces';
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

function getResultEmoji(
  result: RunResult
): string {
  switch (result) {
    case RunResult.SUCCESS: return '✅';
    case RunResult.FAILURE: return '❌';
    default: return '❓';
  }
}

export class Runner {
  public child: ChildProcess | null = null;

  constructor(private readonly appState: AppState) {
    this.run = this.run.bind(this);
    this.test = this.test.bind(this);
    this.stop = this.stop.bind(this);

    ipcRendererManager.removeAllListeners(IpcEvents.FIDDLE_RUN);
    ipcRendererManager.removeAllListeners(IpcEvents.FIDDLE_PACKAGE);
    ipcRendererManager.removeAllListeners(IpcEvents.FIDDLE_MAKE);

    ipcRendererManager.on(IpcEvents.FIDDLE_RUN, this.test);
    ipcRendererManager.on(IpcEvents.FIDDLE_PACKAGE, () => {
      this.performForgeOperation(ForgeCommands.PACKAGE);
    });
    ipcRendererManager.on(IpcEvents.FIDDLE_MAKE, () => {
      this.performForgeOperation(ForgeCommands.MAKE);
    });
  }

  public async autobisect(versions: Array<RunnableVersion>): Promise<RunResult> {
    const bisector = new Bisector(versions);
    let targetVersion = bisector.getCurrentVersion();

    while (true) {
      const { version } = targetVersion;
      this.appState.pushOutput(`Testing ${version}`, { isNotPre: true });

      await this.appState.setVersion(version);
      const result = await this.run(true);
      this.appState.pushOutput(`Bisect Test: ${getResultEmoji(result)} ${result} - Electron ${version}`);

      if (result === RunResult.INVALID) {
        this.appState.pushOutput(`Bisect: failed to test with Electron ${version}`);
        return result;
      }

      const next = bisector.continue(result === RunResult.SUCCESS);

      if (Array.isArray(next)) {
        const [ good, bad ] = next.map(v => `v${v.version}`);
        const url = `https://github.com/electron/electron/compare/${good}...${bad}`;
        this.appState.pushOutput('Runner: Autobisect complete');
        this.appState.pushOutput(`${good} ${getResultEmoji(RunResult.SUCCESS)} passed`);
        this.appState.pushOutput(`${bad} ${getResultEmoji(RunResult.FAILURE)} failed`);
        this.appState.pushOutput('Commits between versions:');
        this.appState.pushOutput(url);
        return RunResult.SUCCESS;
      }

      targetVersion = next;
    }

    return RunResult.FAILURE;
  }

  /**
   * Runs an autobisect session using versions [oldVersion..newVersion].
   *
   * Returns RunResult.INVALID if either version is not present.
   *
   * @param {string} oldVersion
   * @param {string} newVersion
   * @returns {Promise<RunResult>}
   */
  public async autobisectRange(oldVersion: string, newVersion: string): Promise<RunResult> {
    const versions = getVersionRange(
      oldVersion,
      newVersion,
      this.appState.versionsToShow
    );
    return versions && versions.length
      ? this.autobisect(versions)
      : RunResult.INVALID;
  }

  /**
   * Run the current fiddle as a test.
   *
   * @returns {Promise<RunResult>}
   */
  public async test(): Promise<RunResult> {
    // just a readability wrapper around run(true)
    return this.run(true);
  }

  /**
   * Actually run the fiddle.
   *
   * @returns {Promise<RunResult>}
   */
  public async run(test?: boolean): Promise<RunResult> {
    // if it's not ready, wait for it to download
    const { currentElectronVersion } = this.appState;
    if (currentElectronVersion.state !== VersionState.ready) {
      await this.appState.setVersion(currentElectronVersion.version);
    };

    const { version, localPath } = currentElectronVersion;

    if (this.appState.isClearingConsoleOnRun) {
      this.appState.clearConsole();
    }
    this.appState.isConsoleShowing = true;

    const { fileManager, getEditorValues } = window.ElectronFiddle.app;
    const options = { includeDependencies: false, includeElectron: false };
    const values = await getEditorValues(options);
    const dir = await this.saveToTemp(options);
    const packageManager = this.appState.packageManager;

    if (!dir) return RunResult.INVALID;

    try {
      await this.installModulesForEditor(values, { dir, packageManager });
    } catch (error) {
      console.error('Runner: Could not install modules', error);
      fileManager.cleanup(dir);
      return RunResult.INVALID;
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
      return RunResult.INVALID;
    }

    const executor = test ? this.playwright : this.execute;
    return executor.call(this, dir);
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

  public async playwright(dir: string): Promise<RunResult> {
    const { currentElectronVersion, pushOutput } = this.appState;
    const { version, localPath } = currentElectronVersion;
    const binaryPath = getElectronBinaryPath(version, localPath);
    console.log(`Runner: Binary ${binaryPath} ready, launching Playwright tests`);

    const globalsString = JSON.stringify({
      binaryPath,
      dir
    });

    return new Promise((resolve, _reject) => {
      this.child = spawn('jest', [
        '--setupFilesAfterEnv', './src/renderer/jest/playwright-setup',
        '--globals', globalsString,
        '--roots', dir,
        '--no-watchman'
      ]);
      this.appState.isRunning = true;

      this.child.stdout!.on('data', (data) =>
        pushOutput(data, { bypassBuffer: false }),
      );
      this.child.stderr!.on('data', (data) =>
        pushOutput(data, { bypassBuffer: false }),
      );
      this.child.on('close', async (code) => {
        const withCode =
          typeof code === 'number' ? ` with code ${code.toString()}.` : `.`;

        pushOutput(`Electron exited${withCode}`);
        this.appState.isRunning = false;
        this.child = null;

        // Clean older folders
        await window.ElectronFiddle.app.fileManager.cleanup(dir);
        await this.deleteUserData();

        // Resolve this promise with `true` if the test ran without failure
        resolve(code === 0 ? RunResult.SUCCESS : RunResult.FAILURE);
      });
    });
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
    const { currentElectronVersion, pushOutput } = this.appState;
    const { version, localPath } = currentElectronVersion;
    const binaryPath = getElectronBinaryPath(version, localPath);
    console.log(`Runner: Binary ${binaryPath} ready, launching`);

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

    // Add user-specified cli flags if any have been set.
    const options = [dir, '--inspect'].concat(this.appState.executionFlags);

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
      this.child.on('close', async (code) => {
        const withCode =
          typeof code === 'number' ? ` with code ${code.toString()}.` : `.`;

        pushOutput(`Electron exited${withCode}`);
        this.appState.isRunning = false;
        this.child = null;

        // Clean older folders
        await window.ElectronFiddle.app.fileManager.cleanup(dir);
        await this.deleteUserData();

        resolve(code === 0 ? RunResult.SUCCESS : RunResult.FAILURE);
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
    const appData = path.join(this.appState.appData, name);

    console.log(`Cleanup: Deleting data dir ${appData}`);
    await window.ElectronFiddle.app.fileManager.cleanup(appData);
  }
}
