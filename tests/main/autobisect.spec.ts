/**
 * @vitest-environment node
 */

import { WebContents } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RunResult, RunnableVersion } from '../../src/interfaces';
import { IpcEvents } from '../../src/ipc-events';
import { setupAutobisect } from '../../src/main/autobisect';
import { startFiddle } from '../../src/main/fiddle-core';
import { ipcMainManager } from '../../src/main/ipc';
import { pushOutputLine } from '../../src/main/utils/push-output';
import { setVersion } from '../../src/main/utils/set-version';
import { VersionsMock } from '../mocks/electron-versions';
import { WebContentsMock } from '../mocks/web-contents';

vi.mock('../../src/main/fiddle-core');
vi.mock('../../src/main/ipc');
vi.mock('../../src/main/utils/push-output');
vi.mock('../../src/main/utils/set-version');

describe('autobisect', () => {
  let webContents: WebContents;
  let mockVersions: Record<string, RunnableVersion>;
  let mockVersionsArray: RunnableVersion[];
  let invokeAutobisect: (versions: Array<RunnableVersion>) => Promise<unknown>;

  beforeEach(() => {
    ({ mockVersions, mockVersionsArray } = new VersionsMock());
    webContents = new WebContentsMock() as unknown as WebContents;

    setupAutobisect();

    const call = vi
      .mocked(ipcMainManager.on)
      .mock.calls.find(
        ([channelName]) => channelName === IpcEvents.AUTOBISECT_FIDDLE,
      );
    if (!call?.length || call.length < 2) {
      throw new Error('Could not find AUTOBISECT_FIDDLE listener');
    }
    const handler = call[1];
    invokeAutobisect = async (versions) => {
      handler(
        { sender: webContents } as unknown as Electron.IpcMainEvent,
        versions,
      );
      // The IPC listener triggers autobisect() but doesn't return its promise.
      // Wait for the trailing IS_AUTO_BISECTING [false] signal to know the
      // bisection has completed.
      await vi.waitFor(() => {
        const sent = vi
          .mocked(ipcMainManager.send)
          .mock.calls.some(
            ([channel, args]) =>
              channel === IpcEvents.IS_AUTO_BISECTING &&
              Array.isArray(args) &&
              args[0] === false,
          );
        if (!sent) throw new Error('autobisect not finished');
      });
    };
  });

  it('registers the IPC listener', () => {
    expect(ipcMainManager.on).toHaveBeenCalledWith(
      IpcEvents.AUTOBISECT_FIDDLE,
      expect.any(Function),
    );
  });

  it('reports IS_AUTO_BISECTING true while running and false after', async () => {
    vi.mocked(startFiddle).mockResolvedValue(RunResult.SUCCESS);

    await invokeAutobisect([mockVersions['2.0.1']]);

    const autoBisectingCalls = vi
      .mocked(ipcMainManager.send)
      .mock.calls.filter(
        ([channel]) => channel === IpcEvents.IS_AUTO_BISECTING,
      );
    expect(autoBisectingCalls).toHaveLength(2);
    expect(autoBisectingCalls[0][1]).toEqual([true]);
    expect(autoBisectingCalls[1][1]).toEqual([false]);
  });

  it('bails out if not enough versions to bisect', async () => {
    await invokeAutobisect([mockVersions['2.0.1']]);

    expect(pushOutputLine).toHaveBeenLastCalledWith(
      webContents,
      'Runner: autobisect needs at least two Electron versions',
    );
  });

  it('completes a bisection with good and bad bounds', async () => {
    const LAST_GOOD = '2.0.1';
    const FIRST_BAD = '2.0.2';
    expect(mockVersions[LAST_GOOD]).toEqual(expect.anything());
    expect(mockVersions[FIRST_BAD]).toEqual(expect.anything());

    let currentVersion: string | undefined;
    vi.mocked(setVersion).mockImplementation(async (_wc, version: string) => {
      currentVersion = version;
    });
    vi.mocked(startFiddle).mockImplementation(async () => {
      // Run succeeds for versions <= LAST_GOOD, fails for newer ones
      if (!currentVersion) {
        throw new Error('setVersion was not called before startFiddle');
      }
      const [a, b, c] = currentVersion.split('.').map(Number);
      const [la, lb, lc] = LAST_GOOD.split('.').map(Number);
      const cmp = a !== la ? a - la : b !== lb ? b - lb : c - lc;
      return cmp <= 0 ? RunResult.SUCCESS : RunResult.FAILURE;
    });

    const bisectRange = [...mockVersionsArray].reverse();
    await invokeAutobisect(bisectRange);

    expect(setVersion).toHaveBeenCalled();
    expect(pushOutputLine).toHaveBeenLastCalledWith(
      webContents,
      `https://github.com/electron/electron/compare/v${LAST_GOOD}...v${FIRST_BAD}`,
    );
  });

  it('aborts the bisection when startFiddle returns INVALID', async () => {
    vi.mocked(startFiddle).mockResolvedValue(RunResult.INVALID);

    const bisectRange = [...mockVersionsArray].reverse();
    await invokeAutobisect(bisectRange);

    expect(pushOutputLine).toHaveBeenLastCalledWith(
      webContents,
      expect.stringContaining('finished test ❓ invalid'),
    );
  });

  it('reports a tie when good and bad both succeed', async () => {
    vi.mocked(startFiddle).mockResolvedValue(RunResult.SUCCESS);

    const bisectRange = [...mockVersionsArray].reverse();
    await invokeAutobisect(bisectRange);

    expect(pushOutputLine).toHaveBeenLastCalledWith(
      webContents,
      expect.stringMatching('both returned'),
    );
  });

  it('reports a tie when good and bad both fail', async () => {
    vi.mocked(startFiddle).mockResolvedValue(RunResult.FAILURE);

    const bisectRange = [...mockVersionsArray].reverse();
    await invokeAutobisect(bisectRange);

    expect(pushOutputLine).toHaveBeenLastCalledWith(
      webContents,
      expect.stringMatching('both returned'),
    );
  });
});
