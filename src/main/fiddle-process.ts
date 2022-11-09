import { ChildProcess } from 'child_process';
import * as path from 'path';

import {
  BaseVersions,
  Installer,
  ProgressObject,
  Runner,
} from '@electron/fiddle-core';
import { app } from 'electron';
import * as fs from 'fs-extra';

import { FiddleProcessParams, InstallerPaths, RunResult } from '../interfaces';
import { IpcEvents } from '../ipc-events';
import { ipcMainManager } from './ipc';

interface RunFiddleParams {
  localPath: string | undefined;
  isValidBuild: boolean; // If the localPath is a valid Electron build
  version: string; // The user selected version
  dir: string;
}

interface Mirrors {
  electronMirror: string;
  electronNightlyMirror: string;
}

class FiddleProcess {
  // Populating versions in fiddle-core
  private versions: BaseVersions;
  private runner: Promise<Runner>;
  private child: ChildProcess | null = null;

  constructor(
    private readonly installer: Installer,
    private readonly opts: FiddleProcessParams,
  ) {
    this.versions = new BaseVersions(this.opts.versions);
    this.runner = Runner.create({
      installer: this.installer,
      versions: this.versions,
    });

    // Trigger the change state event
    this.installer.on('state-changed', ({ version, state }) => {
      ipcMainManager.send(IpcEvents.INSTALLER_STATE_CHANGE_EVENT, [
        version,
        state,
      ]);
    });
  }

  /**
   * Download the electron version
   */
  public async downloadVersion(version: string, mirror: Mirrors) {
    await this.installer.install(version, {
      mirror,
      progressCallback(progress: ProgressObject) {
        const percent = Math.round(progress.percent * 100) / 100;
        ipcMainManager.send(IpcEvents.DOWNLOAD_ELECTRON_CALLBACK, [
          version,
          percent,
        ]);
      },
    });
  }

  /**
   * Extract the downloaded electron version
   */
  public async installVersion(version: string) {
    await this.installer.install(version);
  }

  /**
   * Executes the fiddle with either local electron build
   * or the user selected electron version
   */
  public async start(params: RunFiddleParams): Promise<RunResult> {
    const { localPath, isValidBuild, version, dir } = params;
    const { executionFlags } = this.opts;
    const fiddleRunner = await this.runner;
    const env = this.buildChildEnvVars();

    // Add user-specified cli flags if any have been set.
    const options = [dir, '--inspect'].concat(executionFlags);

    const cleanup = async () => {
      // Ensure that any buffered console output is
      // printed before a running Fiddle is stopped.
      this.pushOutput('\n', { bypassBuffer: false });

      ipcMainManager.send(IpcEvents.SET_FIDDLE_RUNNING_STATE, [false]);
      this.child = null;

      // Clean older folders
      await this.cleanup(dir);
      await this.deleteUserData();
    };

    return new Promise(async (resolve, _reject) => {
      try {
        this.child = await fiddleRunner.spawn(
          isValidBuild && localPath
            ? Installer.getExecPath(localPath)
            : version,
          dir,
          { args: options, cwd: dir, env },
        );
      } catch (e) {
        this.pushOutput(`Failed to spawn Fiddle: ${e.message}`);
        await cleanup();
        return resolve(RunResult.FAILURE);
      }

      ipcMainManager.send(IpcEvents.SET_FIDDLE_RUNNING_STATE, [true]);

      this.pushOutput(`Electron v${version} started.`);

      this.child?.stdout?.on('data', (data) =>
        this.pushOutput(data, { bypassBuffer: false }),
      );
      this.child?.stderr?.on('data', (data) =>
        this.pushOutput(data, { bypassBuffer: false }),
      );
      this.child?.on('close', async (code, signal) => {
        await cleanup();

        if (typeof code !== 'number') {
          this.pushOutput(`Electron exited with signal ${signal}.`);
          resolve(RunResult.FAILURE);
        } else {
          this.pushOutput(`Electron exited with code ${code}.`);
          resolve(code === 0 ? RunResult.SUCCESS : RunResult.FAILURE);
        }
      });
    });
  }

  /**
   * Stop a currently running Electron fiddle.
   */
  public stop(): void {
    const child = this.child;
    const state = !!child && !child.kill();
    ipcMainManager.send(IpcEvents.SET_FIDDLE_RUNNING_STATE, [state]);

    if (child) {
      // If the child process is still alive 1 second after we've
      // attempted to kill it by normal means, kill it forcefully.
      setTimeout(() => {
        if (child.exitCode === null) {
          child.kill('SIGKILL');
        }
      }, 1000);
    }
  }

  public async uninstallVersion(version: string) {
    await this.installer.remove(version);
  }

  public getVersionState(version: string) {
    return this.installer.state(version);
  }

  private buildChildEnvVars(): { [x: string]: string | undefined } {
    const { isEnablingElectronLogging, environmentVariables } = this.opts;

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
   * Deletes the user data dir after a run.
   */
  private async deleteUserData() {
    if (this.opts.isKeepingUserDataDirs) {
      console.log(
        `Cleanup: Not deleting data dir due to isKeepingUserDataDirs setting`,
      );
      return;
    }

    const { projectName } = this.opts;
    const appData = path.join(app.getPath('appData'), projectName);

    console.log(`Cleanup: Deleting data dir ${appData}`);
    await this.cleanup(appData);
  }

  /**
   * Attempts to clean a given directory. Used to manually
   * clean temp directories.
   *
   * @param {string} [dir]
   */
  private async cleanup(dir?: string): Promise<boolean> {
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
   * Sends an IPC event to push data to appState
   * console
   *
   * @param {string} [data]
   */
  private pushOutput(data: string, opts?: { bypassBuffer: boolean }) {
    ipcMainManager.send(IpcEvents.PUSH_OUTPUT_TO_CONSOLE, [data, opts]);
  }
}

export function setupFiddleListeners() {
  let installer: Installer;

  function initializeInstaller(_: unknown, paths: InstallerPaths) {
    installer = new Installer(paths);
  }

  function initializeListeners(runner: FiddleProcess) {
    const removeVersion = async (_: unknown, version: string) => {
      await runner.uninstallVersion(version);
      return runner.getVersionState(version);
    };

    const installVersion = async (_: unknown, version: string) => {
      return await runner.installVersion(version);
    };

    const fiddleStart = async (_: unknown, opts: RunFiddleParams) => {
      return await runner.start(opts);
    };

    const fiddleStop = () => {
      return runner.stop();
    };

    const downloadVersion = async (_: unknown, args: [string, Mirrors]) => {
      const [version, mirrors] = args;
      await runner.downloadVersion(version, mirrors);
    };

    ipcMainManager.handle(IpcEvents.INSTALL_ELECTRON_VERSION, installVersion);
    ipcMainManager.handle(IpcEvents.UNINSTALL_ELECTRON_VERSION, removeVersion);
    ipcMainManager.handle(IpcEvents.DOWNLOAD_ELECTRON_VERSION, downloadVersion);
    ipcMainManager.handle(IpcEvents.FIDDLE_START, fiddleStart);
    ipcMainManager.on(IpcEvents.FIDDLE_STOP, fiddleStop);
  }

  function initializeFiddleProcess(_: unknown, args: FiddleProcessParams) {
    const runner = new FiddleProcess(installer, args);
    initializeListeners(runner);
  }

  function getVersionState(_: unknown, version: string) {
    return installer.state(version);
  }

  ipcMainManager.handle(IpcEvents.GET_ELECTRON_VERSION_STATE, getVersionState);
  ipcMainManager.on(IpcEvents.INITIALIZE_FIDDLE_INSTALLER, initializeInstaller);
  ipcMainManager.on(
    IpcEvents.INITIALIZE_FIDDLE_PROCESS,
    initializeFiddleProcess,
  );
}
