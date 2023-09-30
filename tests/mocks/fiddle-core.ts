import { EventEmitter } from 'node:events';

import { ChildProcessMock } from './child-process';
import { InstallState } from '../../src/interfaces';

export class InstallerMock extends EventEmitter {
  public state = () => InstallState.installed;
}

export class FiddleRunnerMock {
  public spawn: () => Promise<ChildProcessMock> = jest.fn();
  public static create = jest.fn();
}

export class ElectronVersionsMock {
  public getReleaseInfo = jest.fn();
}
