import * as React  from 'react';
import * as tmp from 'tmp';
import * as fs from 'fs-extra';
import * as path from 'path';
import { observer } from 'mobx-react';
import { spawn, ChildProcess } from 'child_process';

import { normalizeVersion } from '../../utils/normalize-version';
import { AppState } from '../app';

export interface RunnerState {
  isRunning: boolean
}

export interface RunnerProps {
  appState: AppState;
}

@observer
export class Runner extends React.Component<RunnerProps, RunnerState> {
  public child: ChildProcess | null = null;

  constructor(props) {
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
      text = 'Downloading'
    }

    if (isRunning) {
      text = 'Stop'
      action = this.stop;
    }

    return <button className='button' id="run" onClick={() => action()}>{text}</button>;
  }

  public async stop() {
    if (this.child) {
      this.child.kill();
      this.setState({
        isRunning: false
      });
    }
  }

  public pushData(data: string | Buffer) {
    this.props.appState.output.push({
      timestamp: Date.now(),
      text: data.toString()
    });
  }

  public async run() {
    const values = (window as any).electronFiddle.getValues();
    const tmpdir = (tmp as any).dirSync();
    const { binaryManager, version } = this.props.appState;

    try {
      await fs.writeFile(path.join(tmpdir.name, 'index.html'), values.html);
      await fs.writeFile(path.join(tmpdir.name, 'main.js'), values.main);
      await fs.writeFile(path.join(tmpdir.name, 'renderer.js'), values.renderer);
      await fs.writeFile(path.join(tmpdir.name, 'package.json'), values.package);
    } catch (error) {
      console.error('Could not write files', error);
    }

    if (!binaryManager.getIsDownloaded(version)) {
      console.warn(`Binary ${version} not ready`);
      return;
    }

    const binaryPath = this.props.appState.binaryManager.getElectronBinary(version);
    console.log(`Binary ${binaryPath} ready, launching`);

    this.child = spawn(binaryPath, [ tmpdir.name ]);
    this.setState({ isRunning: true });
    this.props.appState.isConsoleShowing = true;
    this.pushData('Electron started.');
    this.child.stdout.on('data', this.pushData);
    this.child.stderr.on('data', this.pushData);
    this.child.on('close', (code) => {
      this.pushData(`Electron exited with code ${code.toString()}.`);
      this.setState({ isRunning: false });
    });
  }
}
