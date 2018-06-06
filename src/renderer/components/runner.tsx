import * as React  from 'react';
import { binary } from '../binary';
import * as tmp from 'tmp';
import * as fs from 'fs-extra';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';

export interface RunnerState {
  isRunning: boolean
}

export class Runner extends React.Component<{}, RunnerState> {
  public child: ChildProcess | null = null;

  constructor(props) {
    super(props);

    this.run = this.run.bind(this);
    this.state = {
      isRunning: false
    };
  }

  public render() {
    const btn = this.state.isRunning
      ? <button id="run" onClick={() => this.stop()}>Stop</button>
      : <button id="run" onClick={() => this.run()}>Run</button>

    return btn;
  }

  public async stop() {
    if (this.child) {
      this.child.kill();
      this.setState({
        isRunning: false
      });
    }
  }

  public async run() {
    const values = (window as any).electronFiddle.getValues();
    const tmpdir = (tmp as any).dirSync();

    try {
      await fs.writeFile(path.join(tmpdir.name, 'index.html'), values.html);
      await fs.writeFile(path.join(tmpdir.name, 'main.js'), values.main);
      await fs.writeFile(path.join(tmpdir.name, 'renderer.js'), values.renderer);
      await fs.writeFile(path.join(tmpdir.name, 'package.json'), values.package);
    } catch (error) {
      console.error('Could not write files', error);
    }

    if (binary.state !== 'ready') {
      console.warn('Binary not ready');
    }

    const binaryPath = binary.getElectronBinary();
    console.log(`Binary ${binaryPath} ready, launching`);

    this.child = spawn(binaryPath, [ tmpdir.name ]);
    this.setState({ isRunning: true });

    this.child.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
    });

    this.child.stderr.on('data', (data) => {
      console.log(`stderr: ${data}`);
    });

    this.child.on('close', (code) => {
      console.log(code);
    });
  }
}
