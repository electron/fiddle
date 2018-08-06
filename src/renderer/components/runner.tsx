import { ChildProcess, spawn } from 'child_process';
import { observer } from 'mobx-react';
import * as path from 'path';
import * as React from 'react';

import { EditorValues, FileTransform } from '../../interfaces';
import { IpcEvents } from '../../ipc-events';
import { PackageJsonOptions } from '../../utils/get-package';
import { normalizeVersion } from '../../utils/normalize-version';
import { ipcRendererManager } from '../ipc';
import { findModulesInEditors, getIsNpmInstalled, installModules, npmRun } from '../npm';
import { AppState } from '../state';

export interface RunnerState {
  isRunning: boolean;
}

export interface RunnerProps {
  appState: AppState;
}

export enum ForgeCommands {
  PACKAGE = 'package',
  MAKE = 'make'
}

/**
 * The runner component is responsible for actually launching the fiddle
 * with Electron. It also renders the button that does so.
 *
 * @class Runner
 * @extends {React.Component<RunnerProps, RunnerState>}
 */
@observer
export class Runner extends React.Component<RunnerProps, RunnerState> {
  public child: ChildProcess | null = null;

  constructor(props: RunnerProps) {
    super(props);

    this.run = this.run.bind(this);
    this.performForgeOperation = this.performForgeOperation.bind(this);
    this.stop = this.stop.bind(this);
    this.state = { isRunning: false };

    this.props.appState.pushOutput('Console ready 🔬');
  }

  public componentDidMount() {
    ipcRendererManager.on(IpcEvents.FIDDLE_RUN, this.run);
    ipcRendererManager.on(IpcEvents.FIDDLE_PACKAGE, () => {
      this.performForgeOperation(ForgeCommands.PACKAGE);
    });
    ipcRendererManager.on(IpcEvents.FIDDLE_MAKE, () => {
      this.performForgeOperation(ForgeCommands.MAKE);
    });
  }

  public render() {
    const { versions, version } = this.props.appState;
    const { isRunning } = this.state;
    if (!versions || !version) return null;

    const state = versions[normalizeVersion(version)].state;

    let text = 'Run';
    let action: () => any = this.run;

    if (state === 'downloading') {
      text = 'Downloading';
    }

    if (isRunning) {
      text = 'Stop';
      action = this.stop;
    }

    return (
      <button
        className='button button-run'
        onClick={() => action()}
      >
          {text}
      </button>
    );
  }

  /**
   * Stop a currently running Electron fiddle.
   */
  public async stop() {
    if (this.child) {
      this.child.kill();
      this.setState({
        isRunning: false
      });
    }
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

    if (modules && modules.length > 0) {
      if (!(await getIsNpmInstalled())) {
        let message = `The modules ${modules.join(', ')} need to be installed, `;
        message += `but we could not find npm. Fiddle requires Node.js and npm `;
        message += `only to support the installation of modules not included in `;
        message += `Electron. Please visit https://nodejs.org to install Node.js `;
        message += `and npm.`;

        this.props.appState.pushOutput(message);
        return;
      }

      this.props.appState.pushOutput(`Installing npm modules: ${modules.join(', ')}...`);
      this.props.appState.pushOutput(await installModules({ dir }, ...modules));
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
    const { appState } = this.props;
    const { version, pushOutput } = appState;

    const binaryPath = appState.binaryManager.getElectronBinaryPath(version);
    console.log(`Runner: Binary ${binaryPath} ready, launching`);

    this.child = spawn(binaryPath, [ dir, '--inspect' ]);
    this.setState({ isRunning: true });
    pushOutput(`Electron v${version} started.`);

    this.child.stdout.on('data', (data) => pushOutput(data, false));
    this.child.stderr.on('data', (data) => pushOutput(data, false));
    this.child.on('close', (code) => {
      pushOutput(`Electron exited with code ${code.toString()}.`);
      this.setState({ isRunning: false });
      this.child = null;
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
    const { pushOutput, pushError } = this.props.appState;

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
      this.props.appState.pushOutput(`Now running "npm install..."`);
      this.props.appState.pushOutput(await installModules({ dir }));
      return true;
    } catch (error) {
      this.props.appState.pushError('Failed to run "npm install".', error);
    }

    return false;
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
    const { dotfilesTransform } = await import('../transforms/dotfiles');
    const { forgeTransform } = await import('../transforms/forge');
    const { appState } = this.props;
    const { pushError, pushOutput } = appState;

    const strings = operation === ForgeCommands.MAKE
      ? [ 'Creating installers for', 'Binary' ]
      : [ 'Packaging', 'Installers' ];

    appState.isConsoleShowing = true;
    pushOutput(`📦 ${strings[0]} current Fiddle...`);

    // Save files to temp
    const dir = await this.saveToTemp(options, dotfilesTransform, forgeTransform);
    if (!dir) return false;

    // Files are now saved to temp, let's install Forge and dependencies
    if (!(await this.npmInstall(dir))) return false;

    // Cool, let's run "package"
    try {
      console.log(`Now creating ${strings[1].toLowerCase()}...`);
      pushOutput(await npmRun({ dir }, operation));
      pushOutput(`✅ ${strings[1]} successfully created.`);
    } catch (error) {
      pushError(`Creating ${strings[1].toLowerCase()} failed.`, error);
      return false;
    }

    const { shell } = await import('electron');
    shell.showItemInFolder(path.join(dir, 'out'));
    return true;
  }

  /**
   * Actually run the fiddle.
   *
   * @returns {Promise<boolean>}
   * @memberof Runner
   */
  public async run(): Promise<boolean> {
    const { appState } = this.props;
    const { fileManager, getValues } = window.ElectronFiddle.app;
    const options = { includeDependencies: false, includeElectron: false };
    const { binaryManager, version } = appState;

    appState.isConsoleShowing = true;

    const isDownloaded = await binaryManager.getIsDownloaded(version);
    const values = await getValues(options);
    const dir = await this.saveToTemp(options);

    if (!dir) return false;

    try {
      await this.installModulesForEditor(values, dir);
    } catch (error) {
      console.error('Runner: Could not install modules', error);
      return false;
    }

    if (!isDownloaded) {
      console.warn(`Runner: Binary ${version} not ready`);
      return false;
    }

    this.execute(dir);

    return true;
  }
}
