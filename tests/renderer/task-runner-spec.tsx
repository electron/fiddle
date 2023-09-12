import { mocked } from 'jest-mock';

import {
  BisectRequest,
  ElectronReleaseChannel,
  FiddleEvent,
  InstallState,
  RunResult,
  RunnableVersion,
  TestRequest,
  VersionSource,
} from '../../src/interfaces';
import { App } from '../../src/renderer/app';
import { TaskRunner } from '../../src/renderer/task-runner';
import { AppMock } from '../mocks/app';
import { RunnerMock } from '../mocks/runner';
import { StateMock } from '../mocks/state';
import { emitEvent, waitFor } from '../utils';

describe('Task Runner component', () => {
  let app: AppMock;
  let appState: StateMock;
  let runner: RunnerMock;

  function makeRunnables(versions: string[]): RunnableVersion[] {
    return versions.map((version) => ({
      source: VersionSource.remote,
      state: InstallState.missing,
      version,
    }));
  }

  beforeEach(() => {
    app = window.app as unknown as AppMock;
    appState = app.state;
    runner = app.runner;
    (runner.autobisect as any).foo = 'a';
    app.taskRunner = new TaskRunner(app as unknown as App);
  });

  async function requestAndWait(event: FiddleEvent, req: any) {
    emitEvent(event, req);
    await waitFor(
      () => mocked(window.ElectronFiddle.taskDone).mock.calls.length > 0,
    );
  }

  describe('bisect request handler', () => {
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

      app.openFiddle.mockResolvedValue(0);
      appState.hasVersion.mockReturnValueOnce(true);
      appState.hideChannels.mockResolvedValue(0);
      appState.setVersion.mockResolvedValue(0);
      appState.showChannels.mockResolvedValue(0);
      appState.versionsToShow = makeRunnables(VERSIONS);
      runner.autobisect.mockResolvedValueOnce(RESULT);

      await requestAndWait('bisect-task', req);

      expect(app.openFiddle).toHaveBeenCalledTimes(1);
      expect(app.openFiddle).toHaveBeenCalledWith(req.setup.fiddle);
      expect(appState.showObsoleteVersions).toBe(USE_OBSOLETE);
      expect(appState.setVersion).not.toHaveBeenCalled();
      expect(appState.showChannels).toHaveBeenCalledTimes(1);
      expect(appState.showChannels).toHaveBeenCalledWith(SHOW);
      expect(window.ElectronFiddle.taskDone).toHaveBeenCalledWith(RESULT);
      expect(runner.autobisect).toHaveBeenCalledTimes(1);
      expect(runner.autobisect).toHaveBeenCalledWith(EXPECTED_VERSIONS);
    });

    it('returns invalid if an exception is thrown', async () => {
      const RESULT = RunResult.INVALID;
      app.openFiddle.mockRejectedValue('💩');

      await requestAndWait('bisect-task', req);

      expect(window.ElectronFiddle.taskDone).toHaveBeenCalledWith(RESULT);
    });
  });

  describe('test request handler', () => {
    const VERSION = '10.0.0';
    const PATH = '/path/to/fiddle';
    const req: TestRequest = {
      setup: {
        showChannels: [],
        hideChannels: [],
        version: VERSION,
        fiddle: {
          localFiddle: {
            filePath: PATH,
            files: {},
          },
        },
      },
    };

    it('invokes the runner and returns the result', async () => {
      const RESULT = RunResult.FAILURE;

      app.openFiddle.mockResolvedValue(0);
      appState.hasVersion.mockReturnValueOnce(true);
      appState.hideChannels.mockResolvedValue(0);
      appState.setVersion.mockResolvedValue(0);
      appState.showChannels.mockResolvedValue(0);
      appState.versionsToShow = makeRunnables([VERSION]);
      runner.run.mockResolvedValueOnce(RESULT);

      await requestAndWait('test-task', req);

      expect(app.openFiddle).toHaveBeenCalledTimes(1);
      expect(app.openFiddle).toHaveBeenCalledWith(req.setup.fiddle);
      expect(appState.hasVersion).toHaveBeenCalledWith(VERSION);
      expect(appState.hideChannels).not.toHaveBeenCalled();
      expect(appState.setVersion).toHaveBeenCalledWith(VERSION);
      expect(appState.showChannels).not.toHaveBeenCalled();
      expect(window.ElectronFiddle.taskDone).toHaveBeenCalledWith(RESULT);
      expect(runner.run).toHaveBeenCalledTimes(1);
    });

    it('returns invalid if an exception is thrown', async () => {
      const RESULT = RunResult.INVALID;

      app.openFiddle.mockResolvedValue(0);
      appState.hasVersion.mockReturnValueOnce(false);
      appState.hideChannels.mockResolvedValue(0);
      appState.setVersion.mockResolvedValue(0);
      appState.showChannels.mockResolvedValue(0);
      runner.run.mockResolvedValueOnce(RESULT);

      await requestAndWait('test-task', req);

      expect(window.ElectronFiddle.taskDone).toHaveBeenCalledWith(RESULT);
      expect(appState.hasVersion).toHaveBeenCalledWith(VERSION);
      expect(appState.setVersion).not.toHaveBeenCalled();
    });
  });
});
