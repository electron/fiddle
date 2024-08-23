import semver from 'semver';

import { Bisector } from './bisect';
import { AppState } from './state';
import { maybePlural } from './utils/plural-maybe';
import {
  FileTransformOperation,
  InstallState,
  MAIN_MJS,
  PMOperationOptions,
  PackageJsonOptions,
  RunResult,
  RunnableVersion,
} from '../interfaces';

const parseEnvString = require('parse-env-string');

export enum ForgeCommands {
  PACKAGE = 'package',
  MAKE = 'make',
}

interface RunFiddleParams {
  localPath: string | undefined;
  isValidBuild: boolean; // If the localPath is a valid Electron build
  version: string; // The user selected version
  dir: string;
}

const resultString: Record<RunResult, string> = Object.freeze({
  [RunResult.FAILURE]: '❌ failed',
  [RunResult.INVALID]: '❓ invalid',
  [RunResult.SUCCESS]: '✅ passed',
});

export class Runner {
  constructor(private readonly appState: AppState) {
    this.run = this.run.bind(this);
    this.stop = this.stop.bind(this);

    window.ElectronFiddle.removeAllListeners('run-fiddle');
    window.ElectronFiddle.removeAllListeners('package-fiddle');
    window.ElectronFiddle.removeAllListeners('make-fiddle');

    window.ElectronFiddle.addEventListener('run-fiddle', this.run);
    window.ElectronFiddle.addEventListener('package-fiddle', () => {
      this.performForgeOperation(ForgeCommands.PACKAGE);
    });
    window.ElectronFiddle.addEventListener('make-fiddle', () => {
      this.performForgeOperation(ForgeCommands.MAKE);
    });
  }

  /**
   * Bisect the current fiddle across the specified versions.
   *
   * @param versions - versions to bisect
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
   * @param versions - versions to bisect
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
   */
  public async run(): Promise<RunResult> {
    const options = { includeDependencies: false, includeElectron: false };

    const { appState } = this;
    const currentRunnable = appState.currentElectronVersion;
    const { version, state, localPath } = currentRunnable;
    const isValidBuild =
      // Destructure currentRunnable so it's not a Proxy object, which can't be used
      window.ElectronFiddle.getLocalVersionState({ ...currentRunnable }) ===
      InstallState.installed;

    // If the current active version is unavailable when we try to run
    // the fiddle, show an error and fall back.
    const { err, ver } = appState.isVersionUsable(version);
    if (!ver) {
      console.warn(`Running fiddle with version ('${version}') failed: ${err}`);
      appState.showErrorDialog(err!);
      const fallback = appState.findUsableVersion();
      if (fallback) await appState.setVersion(fallback.version);
      return RunResult.INVALID;
    }

    if (
      semver.lt(ver.version, '28.0.0') &&
      !ver.version.startsWith('28.0.0-nightly')
    ) {
      const entryPoint = appState.editorMosaic.mainEntryPointFile();

      if (entryPoint === MAIN_MJS) {
        appState.showErrorDialog(
          'ESM main entry points are only supported starting in Electron 28',
        );
        return RunResult.INVALID;
      }
    }

    if (appState.isClearingConsoleOnRun) {
      appState.clearConsole();
    }
    appState.isConsoleShowing = true;

    const dir = await this.saveToTemp(options);
    const packageManager = appState.packageManager;

    if (!dir) return RunResult.INVALID;

    try {
      await this.installModules({ dir, packageManager });
    } catch (error) {
      console.error('Runner: Could not install modules', error);

      appState.pushError('Could not install modules', error.message);
      appState.isInstallingModules = false;

      await window.ElectronFiddle.cleanupDirectory(dir);
      return RunResult.INVALID;
    }

    const isReady =
      state === InstallState.installed ||
      state === InstallState.downloaded ||
      isValidBuild;

    if (!isReady) {
      console.warn(`Runner: Binary ${version} not ready`);

      let message = `Could not start fiddle: `;
      message += `Electron ${version} not downloaded yet. `;
      message += `Please wait for it to finish downloading `;
      message += `before running the fiddle.`;

      appState.pushOutput(message, { isNotPre: true });
      await window.ElectronFiddle.cleanupDirectory(dir);
      return RunResult.INVALID;
    }

    return this.runFiddle({
      localPath,
      isValidBuild,
      dir,
      version,
    });
  }

  /**
   * Stop a currently running Electron fiddle.
   */
  public stop(): void {
    window.ElectronFiddle.stopFiddle();
  }

  /**
   * Uses electron-forge to either package or make the current fiddle
   */
  public async performForgeOperation(
    operation: ForgeCommands,
  ): Promise<boolean> {
    const options = { includeDependencies: true, includeElectron: true };
    const { pushError, pushOutput } = this.appState;

    const strings =
      operation === ForgeCommands.MAKE
        ? ['Creating installers for', 'Binary']
        : ['Packaging', 'Installers'];

    this.appState.isConsoleShowing = true;
    pushOutput(`📦 ${strings[0]} current Fiddle...`);

    const packageManager = this.appState.packageManager;
    const pmInstalled =
      await window.ElectronFiddle.getIsPackageManagerInstalled(packageManager);
    if (!pmInstalled) {
      let message = `Error: Could not find ${packageManager}. Fiddle requires Node.js and npm or yarn `;
      message += `to compile packages. Please visit https://nodejs.org to install `;
      message += `Node.js and npm, or https://classic.yarnpkg.com/lang/en/ `;
      message += `to install Yarn`;

      this.appState.pushOutput(message, { isNotPre: true });
      return false;
    }

    // Save files to temp
    const dir = await this.saveToTemp(options, ['dotfiles', 'forge']);
    if (!dir) return false;

    // Files are now saved to temp, let's install Forge and dependencies
    if (!(await this.packageInstall({ dir, packageManager }))) return false;

    // Cool, let's run "package"
    try {
      console.log(`Now creating ${strings[1].toLowerCase()}...`);
      pushOutput(
        await window.ElectronFiddle.packageRun(
          { dir, packageManager },
          operation,
        ),
      );
      pushOutput(`✅ ${strings[1]} successfully created.`, { isNotPre: true });
    } catch (error) {
      pushError(`Creating ${strings[1].toLowerCase()} failed.`, error);
      return false;
    }

    return true;
  }

  /**
   * Installs the specified modules
   */
  public async installModules(pmOptions: PMOperationOptions): Promise<void> {
    const modules = Array.from(this.appState.modules.entries()).map(
      ([pkg, version]) => `${pkg}@${version}`,
    );
    const { pushOutput } = this.appState;

    if (modules && modules.length > 0) {
      this.appState.isInstallingModules = true;
      const packageManager = pmOptions.packageManager;
      const pmInstalled =
        await window.ElectronFiddle.getIsPackageManagerInstalled(
          packageManager,
        );
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

      const result = await window.ElectronFiddle.addModules(
        pmOptions,
        ...modules,
      );
      pushOutput(result);

      this.appState.isInstallingModules = false;
    }
  }

  public buildChildEnvVars(): { [x: string]: string | undefined } {
    const { environmentVariables } = this.appState;

    const env: Record<string, string> = {};

    for (const envVar of environmentVariables) {
      const errMsg = `Could not parse environment variable: ${envVar}`;

      try {
        const parsed: Record<string, string> | null = parseEnvString(envVar);
        if (!parsed || !Object.keys(parsed).length) {
          this.appState.showErrorDialog(errMsg);
          continue;
        }

        const [key, value] = Object.entries(parsed)[0];
        env[key] = value;
      } catch (e) {
        this.appState.showErrorDialog(errMsg);
      }
    }

    return env;
  }

  /**
   * Executes the fiddle with either local electron build
   * or the user selected electron version
   */
  private async runFiddle(params: RunFiddleParams): Promise<RunResult> {
    const { version, dir } = params;
    const { pushOutput, flushOutput, executionFlags } = this.appState;
    const env = this.buildChildEnvVars();

    // Add user-specified cli flags if any have been set.
    const options = [dir, '--inspect'].concat(executionFlags);

    const cleanup = async () => {
      flushOutput();

      this.appState.isRunning = false;

      // Clean older folders
      await window.ElectronFiddle.cleanupDirectory(dir);
      await this.deleteUserData();
    };

    return new Promise(async (resolve, _reject) => {
      try {
        await window.ElectronFiddle.startFiddle({
          ...params,
          enableElectronLogging: this.appState.isEnablingElectronLogging,
          options,
          env,
        });
      } catch (e) {
        pushOutput(`Failed to spawn Fiddle: ${e.message}`);
        await cleanup();
        return resolve(RunResult.FAILURE);
      }

      this.appState.isRunning = true;

      pushOutput(`Electron v${version} started.`);

      window.ElectronFiddle.removeAllListeners('fiddle-runner-output');
      window.ElectronFiddle.removeAllListeners('fiddle-stopped');

      window.ElectronFiddle.addEventListener(
        'fiddle-runner-output',
        (output: string) => {
          pushOutput(output, { bypassBuffer: false });
        },
      );

      window.ElectronFiddle.addEventListener(
        'fiddle-stopped',
        async (code, signal) => {
          await cleanup();

          if (typeof code !== 'number') {
            pushOutput(`Electron exited with signal ${signal}.`);
            resolve(RunResult.FAILURE);
          } else {
            pushOutput(`Electron exited with code ${code}.`);
            resolve(code === 0 ? RunResult.SUCCESS : RunResult.FAILURE);
          }
        },
      );
    });
  }

  /**
   * Save files to temp, logging to the Fiddle terminal while doing so
   */
  public async saveToTemp(
    options: PackageJsonOptions,
    transforms?: Array<FileTransformOperation>,
  ): Promise<string | null> {
    const { fileManager } = window.app;
    const { pushOutput, pushError } = this.appState;

    try {
      pushOutput(`Saving files to temp directory...`);
      const dir = await fileManager.saveToTemp(options, transforms);
      pushOutput(`Saved files to ${dir}`);
      return dir;
    } catch (error) {
      pushError('Failed to save files.', error.message);
    }

    return null;
  }

  /**
   * Installs modules in a given directory (we're basically
   * just running "\{packageManager\} install")
   */
  public async packageInstall(options: PMOperationOptions): Promise<boolean> {
    const pm = options.packageManager;
    try {
      this.appState.pushOutput(`Now running "${pm} install..."`);
      this.appState.pushOutput(await window.ElectronFiddle.addModules(options));
      return true;
    } catch (error) {
      this.appState.pushError(`Failed to run "${pm} install".`, error);
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

    console.log(`Cleanup: Deleting data dir for ${name}`);
    await window.ElectronFiddle.deleteUserData(name);
  }
}
