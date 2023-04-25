import { Installer } from '@electron/fiddle-core';

import { InstallState } from '../../src/interfaces';
import { ChildProcessMock } from './child-process';

export class InstallerMock extends Installer {
  public state = () => InstallState.installed;
}

export class FiddleRunnerMock {
  public child = new ChildProcessMock();
  public spawn = (): ChildProcessMock => {
    return this.child;
  };
}
