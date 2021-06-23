import {
  BisectRequest,
  ElectronReleaseChannel,
  RunResult,
  RunnableVersion,
  SetFiddleOptions,
  SetupRequest,
  TestRequest,
} from '../interfaces';
import { IpcEvents } from '../ipc-events';

import { App } from './app';
import { AppState } from './state';

import { getVersionRange } from '../utils/get-version-range';
import { normalizeVersion } from '../utils/normalize-version';

import { ipcRendererManager } from './ipc';

export class TaskRunner {
  private readonly appState: AppState;
  private readonly autobisect: (v: RunnableVersion[]) => Promise<RunResult>;
  private readonly done: (r: RunResult) => void;
  private readonly hide: (channels: ElectronReleaseChannel[]) => Promise<void>;
  private readonly log: (message: string) => void;
  private readonly open: (o: SetFiddleOptions) => Promise<void>;
  private readonly run: () => Promise<RunResult>;
  private readonly setVersion: (ver: string) => Promise<void>;
  private readonly show: (channels: ElectronReleaseChannel[]) => Promise<void>;
  private readonly showObsoleteVersions: (show: boolean) => void;

  constructor(app: App) {
    const { runner, state } = app;
    const ipc = ipcRendererManager;

    this.appState = state;
    this.autobisect = runner.autobisect.bind(runner);
    this.done = (r: RunResult) => ipc.send(IpcEvents.TASK_DONE, r);
    this.hide = state.hideChannels.bind(state);
    this.showObsoleteVersions = (use: boolean) =>
      (state.showObsoleteVersions = use);
    this.log = state.pushOutput.bind(state);
    this.open = app.openFiddle.bind(app);
    this.run = runner.run.bind(runner);
    this.setVersion = (ver) => {
      console.log('setVersion', ver);
      if (state.hasVersion(ver)) {
        console.log('calling appState.setVersion', ver);
        return state.setVersion(ver);
      } else {
        console.log('throwing not found');
        throw new Error(`Version "${ver}" not found`);
      }
    };
    this.show = state.showChannels.bind(state);

    this.bisect = this.bisect.bind(this);
    let event = IpcEvents.TASK_BISECT;
    ipc.removeAllListeners(event);
    ipc.on(event, (_, r: BisectRequest) => {
      this.bisect(r);
    });

    this.test = this.test.bind(this);
    event = IpcEvents.TASK_TEST;
    ipc.removeAllListeners(event);
    ipc.on(event, (_, r: TestRequest) => this.test(r));
  }

  private async bisect(req: BisectRequest) {
    const prefix = 'Task: Bisect ';
    const { appState, log } = this;
    let result = RunResult.INVALID;

    try {
      await this.setup(req.setup);

      const good = normalizeVersion(req.goodVersion);
      const bad = normalizeVersion(req.badVersion);
      const range = getVersionRange(good, bad, appState.versionsToShow);
      log(`${prefix} [${range.map((ver) => ver.version).join(', ')}]`);

      result = await this.autobisect(range);
      log(`${prefix} ${result}`);
    } catch (err) {
      log(err);
    }

    this.done(result);
  }

  private async test(req: TestRequest) {
    let result = RunResult.INVALID;
    const { log } = this;

    try {
      await this.setup(req.setup);
      result = await this.run();
    } catch (err) {
      log(err);
    }

    this.done(result);
  }

  private async setup(req: SetupRequest) {
    const { appState, log } = this;
    const { fiddle, hideChannels, showChannels, useObsolete, version } = req;

    appState.resetView();

    if (typeof useObsolete === 'boolean') {
      this.showObsoleteVersions(useObsolete);
    }

    if (hideChannels.length > 0) {
      log(`Task: Hide channels ${hideChannels.join(', ')}`);
      this.hide(hideChannels);
    }

    if (showChannels.length > 0) {
      log(`Task: Show channels ${showChannels.join(', ')}`);
      this.show(showChannels);
    }

    const normVersion = normalizeVersion(version);
    if (normVersion) {
      log(`Task: Use Electron version ${normVersion}`);
      await this.setVersion(normVersion);
    }

    if (fiddle) {
      log(`Task: Open fiddle \"${JSON.stringify(fiddle)}"`);
      await this.open(fiddle);
    }
  }
}
