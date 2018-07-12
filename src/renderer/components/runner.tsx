import * as React from 'react';
import * as fs from 'fs-extra';
import * as path from 'path';
import { observer } from 'mobx-react';
import { spawn, ChildProcess } from 'child_process';

import { normalizeVersion } from '../../utils/normalize-version';
import { AppState } from '../state';
import { installModules, findModulesInEditors } from '../npm';
import { EditorValues, Files } from '../../interfaces';

export interface RunnerState {
  isRunning: boolean;
}

export interface RunnerProps {
  appState: AppState;
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

  private outputBuffer: string = '';

  constructor(props: RunnerProps) {
    super(props);

    this.run = this.run.bind(this);
    this.pushData = this.pushData.bind(this);
    this.stop = this.stop.bind(this);
    this.state = {
      isRunning: false
    };

    this.pushData('Console ready 🔬');
  }

  public render() {
    const { versions, version } = this.props.appState;
    const { isRunning } = this.state;
    if (!versions || !version) return null;

    const state = versions[normalizeVersion(version)].state;

    let text = 'Run';
    let action = this.run;

    if (state === 'downloading') {
      text = 'Downloading';
    }

    if (isRunning) {
      text = 'Stop';
      action = this.stop;
    }

    return <button className='button' onClick={() => action()}>{text}</button>;
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
   * Push output to the application's state. Accepts a buffer or a string as input,
   * attaches a timestamp, and pushes into the store.
   *
   * @param {(string | Buffer)} data
   * @returns
   */
  public pushData(data: string | Buffer, bypassBuffer: boolean = true) {
    let strData = data.toString();
    if (process.platform === 'win32' && !bypassBuffer) {
      this.outputBuffer += strData;
      strData = this.outputBuffer;
      const parts = strData.split('\r\n');
      for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
        const part = parts[partIndex];
        if (partIndex === parts.length - 1) {
          this.outputBuffer = part;
          continue;
        }
        this.pushData(part);
      }
      return;
    }

    if (strData.startsWith('Debugger listening on ws://')) return;
    if (strData === 'For help see https://nodejs.org/en/docs/inspector') return;

    this.props.appState.output.push({
      timestamp: Date.now(),
      text: strData
    });
  }

  /**
   * Analyzes the editor's JavaScript contents for modules
   * and installs them.
   *
   * @param {EditorValues} values
   * @param {string} dir
   * @returns {Promise<void>}
   */
  public async installModules(values: EditorValues, dir: string): Promise<void> {
    const modules = await findModulesInEditors(values);

    if (modules && modules.length > 0) {
      this.pushData(`Installing npm modules: ${modules.join(', ')}...`);
      this.pushData(await installModules({ dir }, ...modules));
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
    const { version } = appState;

    const binaryPath = await appState.binaryManager.getElectronBinaryPath(version);
    console.log(`Runner: Binary ${binaryPath} ready, launching`);

    this.child = spawn(binaryPath, [ dir, '--inspect' ]);
    this.setState({ isRunning: true });
    this.pushData(`Electron v${version} started.`);

    this.child.stdout.on('data', (data) => this.pushData(data, false));
    this.child.stderr.on('data', (data) => this.pushData(data, false));
    this.child.on('close', (code) => {
      this.pushData(`Electron exited with code ${code.toString()}.`);
      this.setState({ isRunning: false });
      this.child = null;
    });
  }

  /**
   * Actually run the fiddle.
   *
   * @returns {Promise<void>}
   * @memberof Runner
   */
  public async run(): Promise<void> {
    const { appState } = this.props;
    const { fileManager, getValues } = window.ElectronFiddle.app;
    const options = { includeDependencies: false, includeElectron: false };
    const { binaryManager, version } = appState;

    const isDownloaded = await binaryManager.getIsDownloaded(version);
    const values = await getValues(options);
    let dir: string;

    appState.isConsoleShowing = true;

    try {
      dir = await fileManager.saveToTemp(options);
      await this.installModules(values, dir);
    } catch (error) {
      console.error('Runner: Could not write files', error);
      return;
    }

    if (!isDownloaded) {
      console.warn(`Runner: Binary ${version} not ready`);
      return;
    }

    this.execute(dir);
  }
}
