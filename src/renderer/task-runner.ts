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
import { IpcRendererManager } from './ipc';
import { Runner } from './runner';

import { getVersionRange } from '../utils/get-version-range';
import { normalizeVersion } from '../utils/normalize-version';

export class TaskRunner {
  private readonly autobisect: (v: RunnableVersion[]) => Promise<RunResult>;
  private readonly done: (r: RunResult) => void;
  private readonly hide: (channels: ElectronReleaseChannel[]) => Promise<void>;
  private readonly log: (message: string) => void;
  private readonly open: (o: SetFiddleOptions) => Promise<void>;
  private readonly run: () => Promise<RunResult>;
  private readonly setVersion: (ver: string) => Promise<void>;
  private readonly show: (channels: ElectronReleaseChannel[]) => Promise<void>;

  constructor(
    app: App,
    private readonly appState: AppState,
    runner: Runner,
    ipc: IpcRendererManager,
  ) {
    this.autobisect = runner.autobisect.bind(runner);
    this.done = (r: RunResult) => ipc.send(IpcEvents.TASK_DONE, r);
    this.hide = this.appState.hideChannels.bind(this.appState);
    this.log = this.appState.pushOutput.bind(this.appState);
    this.open = app.openFiddle.bind(app);
    this.run = runner.run.bind(runner);
    this.setVersion = (ver) => {
      console.log('setVersion', ver);
      if (this.appState.hasVersion(ver)) {
        console.log('calling appState.setVersion', ver);
        return this.appState.setVersion(ver);
      } else {
        console.log('throwing not found');
        throw new Error(`Version "${ver}" not found`);
      }
    };
    this.show = this.appState.showChannels.bind(this.appState);

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
    const { log } = this;
    const { fiddle, hideChannels, showChannels, version } = req;

    if (hideChannels.length > 0) {
      log(`Task: Hide channels ${hideChannels.join(', ')}`);
      await this.hide(hideChannels);
    }

    if (showChannels.length > 0) {
      log(`Task: Show channels ${showChannels.join(', ')}`);
      await this.show(showChannels);
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
