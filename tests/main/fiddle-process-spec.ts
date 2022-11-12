import { ChildProcess } from 'child_process';
import * as path from 'path';

import { Installer, Runner } from '@electron/fiddle-core';

import {
  FiddleProcessParams,
  RunResult,
  RunnableVersion,
} from '../../src/interfaces';
import { IpcEvents } from '../../src/ipc-events';
import { FiddleProcess } from '../../src/main/fiddle-process';
import { ipcMainManager } from '../../src/main/ipc';
import { ChildProcessMock, VersionsMock } from '../mocks/mocks';
import { waitFor } from '../utils';

jest.mock('path');

describe('FiddleProcess class', () => {
  const runFiddleParams = {
    localPath: undefined,
    isValidBuild: false,
    dir: 'mock/foo-fiddle-dir',
    version: '2.0.2',
  } as const;
  let installer: Installer;
  let mockVersionsArray: RunnableVersion[];
  let defaultRunnerParams: FiddleProcessParams;
  let ipcMainSendSpy: jest.SpyInstance<any>;

  beforeEach(async () => {
    ({ mockVersionsArray } = new VersionsMock());
    defaultRunnerParams = {
      versions: mockVersionsArray,
      executionFlags: [],
      environmentVariables: [],
      projectName: 'foo',
      isEnablingElectronLogging: false,
      isKeepingUserDataDirs: false,
    };
    ipcMainManager.removeAllListeners();
    installer = new Installer();
    ipcMainSendSpy = jest.spyOn(ipcMainManager, 'send');

    // Mock the fiddle-core spawn property
    jest.spyOn(Runner.prototype, 'spawn').mockImplementation(() => {
      const child = new ChildProcessMock();
      return (Promise.resolve(child) as unknown) as Promise<ChildProcess>;
    });
  });

  describe('run()', () => {
    it('runs', async () => {
      const runner = new FiddleProcess(installer, defaultRunnerParams);
      const runPromise = runner.start(runFiddleParams);
      await waitFor(() => runner.child !== null);
      expect(runner.child).not.toEqual(null);
      expect(
        ipcMainSendSpy,
      ).toHaveBeenCalledWith(IpcEvents.SET_FIDDLE_RUNNING_STATE, [true]);
      // child process exits with success
      setTimeout(() => (runner.child as ChildProcess).emit('close', 0));
      const result = await runPromise;
      expect(result).toBe(RunResult.SUCCESS);
      expect(
        ipcMainSendSpy,
      ).toHaveBeenCalledWith(IpcEvents.SET_FIDDLE_RUNNING_STATE, [false]);
    });
  });

  it('runs with logging when enabled', async () => {
    const runner = new FiddleProcess(installer, {
      ...defaultRunnerParams,
      isEnablingElectronLogging: true,
    });
    // Override the one placed in beforeEach callback
    const spyChildProcess = jest.spyOn(Runner.prototype, 'spawn');
    (spyChildProcess as jest.Mock).mockImplementationOnce((_, __, opts) => {
      const child = new ChildProcessMock();
      expect(opts.env).toHaveProperty('ELECTRON_ENABLE_LOGGING');
      expect(opts.env).toHaveProperty('ELECTRON_ENABLE_STACK_DUMPING');
      return (Promise.resolve(child) as unknown) as Promise<ChildProcess>;
    });

    // wait for run() to get running
    const runPromise = runner.start(runFiddleParams);
    await waitFor(() => runner.child !== null);
    expect(runner.child).not.toEqual(null);
    expect(
      ipcMainSendSpy,
    ).toHaveBeenCalledWith(IpcEvents.SET_FIDDLE_RUNNING_STATE, [true]);

    // child process exits with success
    setTimeout(() => (runner.child as ChildProcess).emit('close', 0));
    const result = await runPromise;

    expect(result).toBe(RunResult.SUCCESS);
    expect(
      ipcMainSendSpy,
    ).toHaveBeenCalledWith(IpcEvents.SET_FIDDLE_RUNNING_STATE, [false]);
  });

  it('emits output with exitCode', async () => {
    const runner = new FiddleProcess(installer, defaultRunnerParams);
    const pushOutputSpy = jest.spyOn(runner, 'pushOutput');
    const runPromise = runner.start(runFiddleParams);
    // wait for run() to get running
    await waitFor(() => runner.child !== null);
    expect(runner.child).not.toEqual(null);
    expect(
      ipcMainSendSpy,
    ).toHaveBeenCalledWith(IpcEvents.SET_FIDDLE_RUNNING_STATE, [true]);

    // mock child process gives output,
    // then exits with exitCode 0
    runner.child?.stdout?.emit('data', 'hi');
    runner.child?.stderr?.emit('data', 'hi');
    runner.child?.emit('close', 0);

    const result = await runPromise;

    expect(result).toBe(RunResult.SUCCESS);
    expect(
      ipcMainSendSpy,
    ).toHaveBeenCalledWith(IpcEvents.SET_FIDDLE_RUNNING_STATE, [false]);
    expect(pushOutputSpy).toHaveBeenCalledTimes(5);
    expect(pushOutputSpy).toHaveBeenLastCalledWith(
      'Electron exited with code 0.',
    );
  });

  it('returns failure when app exits nonzero', async () => {
    const ARBITRARY_FAIL_CODE = 50;
    const runner = new FiddleProcess(installer, defaultRunnerParams);

    // wait for run() to get running
    const pushOutputSpy = jest.spyOn(runner, 'pushOutput');
    const runPromise = runner.start(runFiddleParams);
    await waitFor(() => runner.child !== null);
    expect(runner.child).not.toEqual(null);
    expect(
      ipcMainSendSpy,
    ).toHaveBeenCalledWith(IpcEvents.SET_FIDDLE_RUNNING_STATE, [true]);

    // mock child process exits with ARBITRARY_FAIL_CODE
    runner.child?.emit('close', ARBITRARY_FAIL_CODE);
    const result = await runPromise;

    expect(result).toBe(RunResult.FAILURE);
    expect(
      ipcMainSendSpy,
    ).toHaveBeenCalledWith(IpcEvents.SET_FIDDLE_RUNNING_STATE, [false]);
    expect(pushOutputSpy).toHaveBeenLastCalledWith(
      `Electron exited with code ${ARBITRARY_FAIL_CODE}.`,
    );
  });

  it('emits output without exitCode', async () => {
    const runner = new FiddleProcess(installer, defaultRunnerParams);
    const pushOutputSpy = jest.spyOn(runner, 'pushOutput');
    const runPromise = runner.start(runFiddleParams);
    // wait for run() to get running
    await waitFor(() => runner.child !== null);
    expect(runner.child).not.toEqual(null);
    expect(
      ipcMainSendSpy,
    ).toHaveBeenCalledWith(IpcEvents.SET_FIDDLE_RUNNING_STATE, [true]);

    const signal = 'SIGTERM';
    // mock child process gives output,
    // then exits without an explicit exitCode
    runner.child?.stdout?.emit('data', 'hi');
    runner.child?.stderr?.emit('data', 'hi');
    runner.child?.emit('close', null, signal);

    const result = await runPromise;

    expect(result).toBe(RunResult.FAILURE);
    expect(
      ipcMainSendSpy,
    ).toHaveBeenCalledWith(IpcEvents.SET_FIDDLE_RUNNING_STATE, [false]);
    expect(pushOutputSpy).toHaveBeenCalledTimes(5);
    expect(pushOutputSpy).toHaveBeenLastCalledWith(
      `Electron exited with signal ${signal}.`,
    );
  });

  it('cleans the app data dir after a run', async () => {
    const runner = new FiddleProcess(installer, defaultRunnerParams);
    setTimeout(() => runner.child?.emit('close', 0));
    const cleanupFuncSpy = jest.spyOn(runner, 'cleanup');
    const result = await runner.start(runFiddleParams);

    expect(result).toBe(RunResult.SUCCESS);
    await process.nextTick;
    expect(cleanupFuncSpy).toHaveBeenCalledTimes(2);
    expect(cleanupFuncSpy).toHaveBeenLastCalledWith(
      path.join(runFiddleParams.dir),
    );
  });

  it('does not clean the app data dir after a run if configured', async () => {
    const runner = new FiddleProcess(installer, {
      ...defaultRunnerParams,
      isKeepingUserDataDirs: true,
    });
    setTimeout(() => runner?.child?.emit('close', 0));
    const cleanupFuncSpy = jest.spyOn(runner, 'cleanup');
    const result = await runner.start(runFiddleParams);

    expect(result).toBe(RunResult.SUCCESS);
    await process.nextTick;
    expect(cleanupFuncSpy).toHaveBeenCalledTimes(1);
  });

  describe('stop()', () => {
    it('stops a running session', async () => {
      const runner = new FiddleProcess(installer, defaultRunnerParams);

      jest.spyOn(Runner.prototype, 'spawn').mockImplementation(() => {
        const child = new ChildProcessMock();
        child.kill.mockImplementationOnce(() => {
          runner.child?.emit('close');
          return true;
        });
        return (Promise.resolve(child) as unknown) as Promise<ChildProcess>;
      });

      const runPromise = runner.start(runFiddleParams);
      await waitFor(() => runner.child !== null);
      expect(runner.child).not.toEqual(null);
      expect(
        ipcMainSendSpy,
      ).toHaveBeenCalledWith(IpcEvents.SET_FIDDLE_RUNNING_STATE, [true]);

      // call stop and wait for run() to resolve
      runner.stop();
      const runResult = await runPromise;

      expect(runResult).toBe(RunResult.FAILURE);
      expect(
        ipcMainSendSpy,
      ).toHaveBeenCalledWith(IpcEvents.SET_FIDDLE_RUNNING_STATE, [false]);
    });

    it('fails if killing child process fails', async () => {
      const runner = new FiddleProcess(installer, defaultRunnerParams);

      jest.spyOn(Runner.prototype, 'spawn').mockImplementation(() => {
        const child = new ChildProcessMock();
        child.kill.mockReturnValueOnce(false);
        return (Promise.resolve(child) as unknown) as Promise<ChildProcess>;
      });

      // wait for run() to get running
      runner.start(runFiddleParams);
      await waitFor(() => runner.child !== null);
      expect(runner.child).not.toEqual(null);

      runner.stop();
      expect(
        ipcMainSendSpy,
      ).toHaveBeenCalledWith(IpcEvents.SET_FIDDLE_RUNNING_STATE, [true]);
    });
  });
});
