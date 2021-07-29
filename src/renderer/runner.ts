import * as os from 'os';
import * as path from 'path';
import isRunning from 'is-running';
import { ChildProcess } from 'child_process';
import { Stream } from 'stream';

import {
  EditorValues,
  FileTransform,
  RunResult,
  RunnableVersion,
} from '../interfaces';
import { IpcEvents } from '../ipc-events';
import { PackageJsonOptions } from '../utils/get-package';
import { maybePlural } from '../utils/plural-maybe';
import { ipcRendererManager } from './ipc';
import {
  findModulesInEditors,
  getIsPackageManagerInstalled,
  installModules,
  packageRun,
  PMOperationOptions,
} from './npm';
import { AppState } from './state';
import {
  FiddleFactory,
  Installer,
  Paths as RunnerPaths,
  Runner as FiddleRunner,
  SpawnSyncOptions,
  SpawnOptions,
} from 'electron-fiddle-runner';
import { USER_DATA_PATH } from './constants';

export enum ForgeCommands {
  PACKAGE = 'package',
  MAKE = 'make',
}

export class Runner {
  public child: ChildProcess | null = null;
  private runner: FiddleRunner;
  private readonly fiddleFactory: FiddleFactory;

  constructor(
    private readonly appState: AppState,
    private readonly installer: Installer,
  ) {
    const paths: Partial<RunnerPaths> = {
      versionsCache: path.join(USER_DATA_PATH, 'versions.json'),
      fiddles: path.join(os.tmpdir(), 'electron-fiddles'),
    };
    this.fiddleFactory = new FiddleFactory(paths.fiddles);
    FiddleRunner.create({
      fiddleFactory: this.fiddleFactory,
      installer: this.installer,
      paths,
    }).then((runner) => (this.runner = runner));

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

    // show the console
    if (appState.isClearingConsoleOnRun) appState.clearConsole();
    appState.isConsoleShowing = true;

    // FIXME: install packages

    // autobisect
    const { pushOutput } = this.appState;
    const out = new Stream.PassThrough();
    out.on('readable', () => pushOutput(out.read()));
    const opts: SpawnSyncOptions = { out, showConfig: false };
    appState.isRunning = true;
    await this.runner.bisect(
      versions[0].version,
      versions[versions.length - 1].version,
      Object.entries(await window.ElectronFiddle.app.getEditorValues()),
      opts,
    );
    appState.isRunning = false;

    return RunResult.SUCCESS;
  }

  /**
   * Actually run the fiddle.
   *
   * @returns {Promise<RunResult>}
   */
  public async run(): Promise<RunResult> {
    const { appState } = this;
    const { state, version } = appState.currentElectronVersion;

    if (state !== 'installed') {
      console.warn(`Runner: Binary ${version} not ready`);
      const message = `Please wait for ${version} to finish installing before running the fiddle.`;
      appState.pushOutput(message, { isNotPre: true });
      return RunResult.INVALID;
    }

    if (appState.isClearingConsoleOnRun) appState.clearConsole();
    appState.isConsoleShowing = true;

    return this.execute();
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
  public async execute(): Promise<RunResult> {
    // spawn the process
    const {
      currentElectronVersion,
      flushOutput,
      // isKeepingUserDataDirs,
      pushOutput,
    } = this.appState;
    const { version, localPath } = currentElectronVersion;

    // create the fiddle snapshot
    const { getEditorValues } = window.ElectronFiddle.app;
    const values = await getEditorValues();
    const entries = Object.entries(values) as Iterable<[string, string]>;
    const fiddle = await this.fiddleFactory.create(entries);

    const env = this.buildChildEnvVars();
    const opts: SpawnOptions = { env, showConfig: false };

    const child = await this.runner.spawn(localPath || version, fiddle!, opts);

    this.child = child;
    this.appState.isRunning = true;
    pushOutput(`Electron v${version} started.`);

    return new Promise((resolve) => {
      const onData = (str: string) => pushOutput(str, { bypassBuffer: false });
      child.stdout!.on('data', onData);
      child.stderr!.on('data', onData);
      child.on('close', async (code, signal) => {
        flushOutput();
        this.appState.isRunning = false;
        this.child = null;
        // FIXME if (!isKeepingUserDataDirs) await fiddle!.remove();
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
}
