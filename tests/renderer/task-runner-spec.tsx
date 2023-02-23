import { InstallState } from '@electron/fiddle-core';

import {
  BisectRequest,
  ElectronReleaseChannel,
  RunResult,
  RunnableVersion,
  TestRequest,
  VersionSource,
} from '../../src/interfaces';
import { IpcEvents } from '../../src/ipc-events';
import { App } from '../../src/renderer/app';
import { ipcRendererManager } from '../../src/renderer/ipc';
import { TaskRunner } from '../../src/renderer/task-runner';
import { AppMock } from '../mocks/app';
import { StateMock } from '../mocks/state';

describe('Task Runner component', () => {
  let app: AppMock;
  let appState: StateMock;
  let runner: any;
  let ipc: any;

  function makeRunnables(versions: string[]): RunnableVersion[] {
    return versions.map((version) => ({
      source: VersionSource.remote,
      state: InstallState.missing,
      version,
    }));
  }

  beforeEach(() => {
    app = (window.ElectronFiddle.app as unknown) as AppMock;
    appState = app.state;
    runner = app.runner;
    runner.autobisect.foo = 'a';
    ipc = ipcRendererManager;
    app.taskRunner = new TaskRunner((app as unknown) as App);
  });

  async function requestAndWait(ipcEvent: IpcEvents, req: any) {
    let resolve: any;
    const fakeEvent = {};
    const taskPromise = new Promise((r) => (resolve = r));
    const sendSpy = jest
      .spyOn(ipc, 'send')
      .mockImplementationOnce((...params) => resolve(params));
    ipc.emit(ipcEvent, fakeEvent, req);
    const result: any = await taskPromise;
    sendSpy.mockReset();
    return result;
  }

  describe('ipc bisect request handler', () => {
    const GOOD = '10.0.0';
    const BAD = '11.0.2';
    const GIST_ID = '8c5fc0c6a5153d49b5a4a56d3ed9da8f';
    const SHOW = [ElectronReleaseChannel.stable];
    const HIDE = [ElectronReleaseChannel.beta, ElectronReleaseChannel.nightly];
    const USE_OBSOLETE = true;
    const VERSIONS = [
      '12.0.0',
      '11.2.0',
      '11.1.0',
      '11.0.2',
      '11.0.1',
      '11.0.0',
      '10.1.0',
      '10.0.0',
      '9.0.0',
    ];
    const EXPECTED_VERSIONS = makeRunnables(
      VERSIONS.slice(VERSIONS.indexOf(BAD), VERSIONS.indexOf(GOOD) + 1),
    ).reverse();
    const req: BisectRequest = {
      goodVersion: GOOD,
      badVersion: BAD,
      setup: {
        showChannels: SHOW,
        hideChannels: HIDE,
        useObsolete: USE_OBSOLETE,
        fiddle: {
          gistId: GIST_ID,
        },
      },
    };

    it('invokes the runner and returns the result', async () => {
      const RESULT = RunResult.SUCCESS;

      (app.openFiddle as jest.Mock).mockResolvedValue(0);
      (appState.hasVersion as jest.Mock).mockReturnValueOnce(true);
      (appState.hideChannels as jest.Mock).mockResolvedValue(0);
      (appState.setVersion as jest.Mock).mockResolvedValue(0);
      (appState.showChannels as jest.Mock).mockResolvedValue(0);
      (appState.versionsToShow as any) = makeRunnables(VERSIONS);
      (runner.autobisect as jest.Mock).mockResolvedValueOnce(RESULT);

      const result = await requestAndWait(IpcEvents.TASK_BISECT, req);

      expect(app.openFiddle).toHaveBeenCalledTimes(1);
      expect(app.openFiddle).toHaveBeenCalledWith(req.setup.fiddle);
      expect(appState.showObsoleteVersions).toBe(USE_OBSOLETE);
      expect(appState.setVersion).not.toHaveBeenCalled();
      expect(appState.showChannels).toHaveBeenCalledTimes(1);
      expect(appState.showChannels).toHaveBeenCalledWith(SHOW);
      expect(result[0]).toBe(IpcEvents.TASK_DONE);
      expect(result[1]).toBe(RESULT);
      expect(runner.autobisect).toHaveBeenCalledTimes(1);
      expect(runner.autobisect).toHaveBeenCalledWith(EXPECTED_VERSIONS);
    });

    it('returns invalid if an exception is thrown', async () => {
      const RESULT = RunResult.INVALID;
      (app.openFiddle as jest.Mock).mockRejectedValue('💩');

      const result = await requestAndWait(IpcEvents.TASK_BISECT, req);

      expect(result[0]).toBe(IpcEvents.TASK_DONE);
      expect(result[1]).toBe(RESULT);
    });
  });

  describe('ipc test request handler', () => {
    const VERSION = '10.0.0';
    const PATH = '/path/to/fiddle';
    const req: TestRequest = {
      setup: {
        showChannels: [],
        hideChannels: [],
        version: VERSION,
        fiddle: {
          filePath: PATH,
        },
      },
    };

    it('invokes the runner and returns the result', async () => {
      const RESULT = RunResult.FAILURE;

      (app.openFiddle as jest.Mock).mockResolvedValue(0);
      (appState.hasVersion as jest.Mock).mockReturnValueOnce(true);
      (appState.hideChannels as jest.Mock).mockResolvedValue(0);
      (appState.setVersion as jest.Mock).mockResolvedValue(0);
      (appState.showChannels as jest.Mock).mockResolvedValue(0);
      (appState.versionsToShow as any) = makeRunnables([VERSION]);
      (runner.run as jest.Mock).mockResolvedValueOnce(RESULT);

      const result = await requestAndWait(IpcEvents.TASK_TEST, req);

      expect(app.openFiddle).toHaveBeenCalledTimes(1);
      expect(app.openFiddle).toHaveBeenCalledWith(req.setup.fiddle);
      expect(appState.hasVersion).toHaveBeenCalledWith(VERSION);
      expect(appState.hideChannels).not.toHaveBeenCalled();
      expect(appState.setVersion).toHaveBeenCalledWith(VERSION);
      expect(appState.showChannels).not.toHaveBeenCalled();
      expect(result[0]).toBe(IpcEvents.TASK_DONE);
      expect(result[1]).toBe(RESULT);
      expect(runner.run).toHaveBeenCalledTimes(1);
    });

    it('returns invalid if an exception is thrown', async () => {
      const RESULT = RunResult.INVALID;

      (app.openFiddle as jest.Mock).mockResolvedValue(0);
      (appState.hasVersion as jest.Mock).mockReturnValueOnce(false);
      (appState.hideChannels as jest.Mock).mockResolvedValue(0);
      (appState.setVersion as jest.Mock).mockResolvedValue(0);
      (appState.showChannels as jest.Mock).mockResolvedValue(0);
      (runner.run as jest.Mock).mockResolvedValueOnce(RESULT);

      const result = await requestAndWait(IpcEvents.TASK_TEST, req);

      expect(result[0]).toBe(IpcEvents.TASK_DONE);
      expect(result[1]).toBe(RESULT);
      expect(appState.hasVersion).toHaveBeenCalledWith(VERSION);
      expect(appState.setVersion).not.toHaveBeenCalled();
    });
  });
});
