import * as React from 'react';
import * as fs from 'fs-extra';
import * as path from 'path';
import { observer } from 'mobx-react';
import { spawn, ChildProcess } from 'child_process';

import { normalizeVersion } from '../../utils/normalize-version';
import { AppState } from '../state';
import { installModules, findModulesInEditors } from '../npm';
import { EditorValues } from '../../interfaces';

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
   * Actually run the fiddle.
   *
   * @returns
   * @memberof Runner
   */
  public async run(): Promise<void> {
    const { appState } = this.props;
    const options = { includeDependencies: false, includeElectron: false };
    const values = await window.ElectronFiddle.app.getValues(options);
    const { binaryManager, version, tmpDir } = appState;
    const isDownloaded = await binaryManager.getIsDownloaded(version);

    appState.isConsoleShowing = true;

    try {
      await fs.writeFile(path.join(tmpDir.name, 'index.html'), values.html);
      await fs.writeFile(path.join(tmpDir.name, 'main.js'), values.main);
      await fs.writeFile(path.join(tmpDir.name, 'renderer.js'), values.renderer);
      await fs.writeFile(path.join(tmpDir.name, 'package.json'), values.package);
      await this.installModules(values, tmpDir.name);
    } catch (error) {
      console.error('Runner: Could not write files', error);
    }

    if (!isDownloaded) {
      console.warn(`Runner: Binary ${version} not ready`);
      return;
    }

    const binaryPath = await appState.binaryManager.getElectronBinaryPath(version);
    console.log(`Runner: Binary ${binaryPath} ready, launching`);

    this.child = spawn(binaryPath, [ tmpDir.name, '--inspect' ]);
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
}
