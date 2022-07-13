import { InstallState, Installer } from '@aryanshridhar/fiddle-core';

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
