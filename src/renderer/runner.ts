import parseEnvString from 'parse-env-string';
import semver from 'semver';

import { AppState } from './state';
import {
  FileTransformOperation,
  InstallState,
  MAIN_MJS,
  PMOperationOptions,
  PackageJsonOptions,
  RunResult,
  StartFiddleOptions,
  VersionSource,
} from '../interfaces';

export enum ForgeCommands {
  PACKAGE = 'package',
  MAKE = 'make',
}

export class Runner {
  constructor(private readonly appState: AppState) {
    this.run = this.run.bind(this);
    this.getStartFiddleOptions = this.getStartFiddleOptions.bind(this);

    window.ElectronFiddle.removeAllListeners('run-fiddle');
    window.ElectronFiddle.removeAllListeners('package-fiddle');
    window.ElectronFiddle.removeAllListeners('make-fiddle');
    window.ElectronFiddle.removeAllListeners('is-auto-bisecting');

    window.ElectronFiddle.addEventListener('run-fiddle', this.run);
    window.ElectronFiddle.addEventListener('package-fiddle', () => {
      this.performForgeOperation(ForgeCommands.PACKAGE);
    });
    window.ElectronFiddle.addEventListener('make-fiddle', () => {
      this.performForgeOperation(ForgeCommands.MAKE);
    });
    window.ElectronFiddle.addEventListener(
      'is-auto-bisecting',
      (isAutoBisecting: boolean) => {
        this.appState.isAutoBisecting = isAutoBisecting;
      },
    );

    window.ElectronFiddle.onGetStartFiddleOptions(this.getStartFiddleOptions);
    window.ElectronFiddle.onSetVersion((version: string) =>
      this.appState.setVersion(version),
    );
  }

  /**
   * Actually run the fiddle.
   */
  public async run(): Promise<RunResult> {
    const { appState } = this;
    const currentRunnable = appState.currentElectronVersion;
    const { version, state } = currentRunnable;
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
      ver.source !== VersionSource.local &&
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
      return RunResult.INVALID;
    }

    return this.runFiddle();
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
    const useSocketFirewall = this.appState.isUsingSocketFirewall;
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
    if (
      !(await this.packageInstall({ dir, packageManager, useSocketFirewall }))
    )
      return false;

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
    } catch (error: any) {
      pushError(`Creating ${strings[1].toLowerCase()} failed.`, error);
      return false;
    }

    return true;
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
   * or the user selected electron version. The main process owns the
   * temp directory, module installation, and cleanup — the renderer
   * simply triggers the run and waits for the `fiddle-stopped` event.
   */
  private async runFiddle(): Promise<RunResult> {
    const { pushOutput, flushOutput } = this.appState;

    const cleanup = () => {
      flushOutput();
      this.appState.isRunning = false;
      this.appState.isInstallingModules = false;
    };

    return new Promise(async (resolve) => {
      window.ElectronFiddle.removeAllListeners('fiddle-runner-output');
      window.ElectronFiddle.removeAllListeners('fiddle-modules-installed');
      window.ElectronFiddle.removeAllListeners('fiddle-stopped');

      window.ElectronFiddle.addEventListener(
        'fiddle-runner-output',
        (output: string, options?: { isNotPre?: boolean }) => {
          pushOutput(output, { ...options, bypassBuffer: false });
        },
      );

      window.ElectronFiddle.addEventListener('fiddle-modules-installed', () => {
        this.appState.isInstallingModules = false;
      });

      window.ElectronFiddle.addEventListener(
        'fiddle-stopped',
        (code, signal) => {
          cleanup();

          if (typeof code !== 'number') {
            pushOutput(`Electron exited with signal ${signal}.`);
            resolve(RunResult.FAILURE);
          } else {
            pushOutput(`Electron exited with code ${code}.`);
            resolve(code === 0 ? RunResult.SUCCESS : RunResult.FAILURE);
          }
        },
      );

      this.appState.isRunning = true;

      try {
        await window.ElectronFiddle.startFiddle();
      } catch (e: any) {
        pushOutput(`Failed to spawn Fiddle: ${e.message}`);
        cleanup();
        resolve(RunResult.FAILURE);
      }
    });
  }

  /**
   * Build the options object the main process needs to run the current
   * fiddle. Sent in response to a request from main.
   */
  public async getStartFiddleOptions(): Promise<StartFiddleOptions> {
    const { appState } = this;

    const modules = Array.from(appState.modules.entries());
    if (modules.length > 0) {
      appState.isInstallingModules = true;
    }

    return {
      version: appState.currentElectronVersion.version,
      enableElectronLogging: appState.isEnablingElectronLogging,
      executionFlags: [...appState.executionFlags],
      env: this.buildChildEnvVars(),
      modules,
      packageManager: appState.packageManager,
      useSocketFirewall: appState.isUsingSocketFirewall,
      isKeepingUserDataDirs: appState.isKeepingUserDataDirs,
    };
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
    } catch (error: any) {
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
    } catch (error: any) {
      this.appState.pushError(`Failed to run "${pm} install".`, error);
    }

    return false;
  }
}
