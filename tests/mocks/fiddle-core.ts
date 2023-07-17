import { Installer } from '@electron/fiddle-core';

import { ChildProcessMock } from './child-process';
import { InstallState } from '../../src/interfaces';

export class InstallerMock extends Installer {
  public state = () => InstallState.installed;
}

export class FiddleRunnerMock {
  public child = new ChildProcessMock();
  public spawn = (): ChildProcessMock => {
    return this.child;
  };
}
