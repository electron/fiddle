import { EventEmitter } from 'node:events';

import { vi } from 'vitest';

import { ChildProcessMock } from './child-process';
import { InstallState } from '../../src/interfaces';

export class InstallerMock extends EventEmitter {
  public state = () => InstallState.installed;
}

export class FiddleRunnerMock {
  public spawn: () => Promise<ChildProcessMock> = vi.fn();
  public static create = vi.fn();
}

export class ElectronVersionsMock {
  public getReleaseInfo = vi.fn();
}
