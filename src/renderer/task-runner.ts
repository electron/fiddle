import { BisectRequest, TestRequest, RunResult, SetupRequest } from '../interfaces';
import { IpcEvents } from '../ipc-events';
import { normalizeVersion } from '../utils/normalize-version';

import { ipcRendererManager } from './ipc';
import { AppState } from './state';

export class TaskRunner {
  constructor(private readonly appState: AppState) {
    this.bisect = this.bisect.bind(this);
    this.test = this.test.bind(this);

    let event = IpcEvents.FIDDLE_BISECT;
    ipcRendererManager.removeAllListeners(event);
    ipcRendererManager.on(event, (_, req: BisectRequest) => this.bisect(req));

    event = IpcEvents.FIDDLE_TEST;
    ipcRendererManager.removeAllListeners(event);
    ipcRendererManager.on(event, (_, req: TestRequest) => this.test(req));
  }

  private async bisect(req: BisectRequest) {
    let result = RunResult.INVALID;
    try {
      await this.setup(req.setup);

      const good = normalizeVersion(req.goodVersion);
      const bad = normalizeVersion(req.badVersion);
      this.appState.pushOutput(`Task: Bisect [${good}..${bad}]`);
      result = await window.ElectronFiddle.app.runner.autobisectRange(good, bad);
      this.appState.pushOutput(`Task: Bisect ${result}`);
    } catch (err) {
      this.appState.pushOutput(err);
    }
    ipcRendererManager.send(IpcEvents.TASK_DONE, result);
  }

  private async test(req: TestRequest) {
    let result = RunResult.INVALID;
    try {
      await this.setup(req.setup);

      this.appState.pushOutput('Task: Test');
      result = await window.ElectronFiddle.app.runner.test();
      this.appState.pushOutput(`Task: Test ${result}`);
    } catch (err) {
      this.appState.pushOutput(err);
    }
    ipcRendererManager.send(IpcEvents.TASK_DONE, result);
  }

  private async setup(req: SetupRequest) {
    const { showChannels, hideChannels, version } = req;
    const { appState } = this;

    if (hideChannels.length > 0) {
      appState.pushOutput(`Task: Hide channels ${hideChannels.join(', ')}`);
      await appState.hideChannels(hideChannels);
    }

    if (showChannels.length > 0) {
      appState.pushOutput(`Task: Show channels ${showChannels.join(', ')}`);
      await appState.showChannels(hideChannels);
    }

    const normVersion = normalizeVersion(version);
    if (normVersion) {
      appState.pushOutput(`Task: Use Electron version ${normVersion}`);
      await appState.setVersion(normVersion, { strict: true });
    }

    if (req.fiddle) {
      const { filePath, gistId } = req.fiddle;
      if (filePath) {
        appState.pushOutput(`Task: Open fiddle \"${filePath}"`);
        await window.ElectronFiddle.app.fileManager.openFiddle(filePath);
      } else if (gistId) {
        appState.pushOutput(`Task: Open Gist \"${gistId}"`);
        await window.ElectronFiddle.app.remoteLoader.fetchGistAndLoad(gistId);
      }
    };
  }
}
