import type { IpcMainEvent, WebContents } from 'electron';

import { startFiddle } from './fiddle-core';
import { ipcMainManager } from './ipc';
import { pushOutputLine } from './utils/push-output';
import { setVersion } from './utils/set-version';
import { RunResult, RunnableVersion } from '../interfaces';
import { IpcEvents } from '../ipc-events';
import { Bisector } from '../utils/bisect';

const resultString: Record<RunResult, string> = Object.freeze({
  [RunResult.FAILURE]: '❌ failed',
  [RunResult.INVALID]: '❓ invalid',
  [RunResult.SUCCESS]: '✅ passed',
});

/**
 * Bisect the current fiddle across the specified versions.
 *
 * @param versions - versions to bisect
 */
async function autobisect(
  webContents: WebContents,
  versions: Array<RunnableVersion>,
) {
  try {
    ipcMainManager.send(IpcEvents.IS_AUTO_BISECTING, [true], webContents);
    await autobisectImpl(webContents, versions);
  } finally {
    ipcMainManager.send(IpcEvents.IS_AUTO_BISECTING, [false], webContents);
  }
}

async function autobisectImpl(
  webContents: WebContents,
  versions: Array<RunnableVersion>,
) {
  const prefix = `Runner: autobisect`;

  // precondition: can't bisect unless we have >= 2 versions
  if (versions.length < 2) {
    pushOutputLine(
      webContents,
      `${prefix} needs at least two Electron versions`,
    );
    return;
  }

  const results: Map<string, RunResult> = new Map();

  const runVersion = async (version: string) => {
    let result = results.get(version);
    if (result === undefined) {
      const pre = `${prefix} Electron ${version} -`;
      pushOutputLine(webContents, `${pre} setting version`);
      await setVersion(webContents, version);
      pushOutputLine(webContents, `${pre} starting test`);
      result = await startFiddle(webContents);
      results.set(version, result);
      pushOutputLine(
        webContents,
        `${pre} finished test ${resultString[result]}`,
      );
    }
    return result;
  };

  const bisector = new Bisector(versions);
  let targetVersion = bisector.getCurrentVersion();
  let next;
  while (true) {
    const { version } = targetVersion;

    const result = await runVersion(version);
    if (result === RunResult.INVALID) {
      return result;
    }

    next = bisector.continue(result === RunResult.SUCCESS);
    if (Array.isArray(next)) {
      break;
    }

    targetVersion = next;
  }

  const [good, bad] = next.map((v) => v.version);
  const resultGood = await runVersion(good);
  const resultBad = await runVersion(bad);
  if (resultGood === resultBad) {
    pushOutputLine(
      webContents,
      `${prefix} 'good' ${good} and 'bad' ${bad} both returned ${resultString[resultGood]}`,
    );
    return;
  }

  const msgs = [
    `${prefix} complete`,
    `${prefix} ${resultString[RunResult.SUCCESS]} ${good}`,
    `${prefix} ${resultString[RunResult.FAILURE]} ${bad}`,
    `${prefix} Commits between versions:`,
    `https://github.com/electron/electron/compare/v${good}...v${bad}`,
  ];
  msgs.forEach((msg) => pushOutputLine(webContents, msg));
}

/**
 * Wire up the IPC handler so the renderer can trigger an autobisect.
 */
export function setupAutobisect(): void {
  ipcMainManager.on(
    IpcEvents.AUTOBISECT_FIDDLE,
    (event: IpcMainEvent, versions: Array<RunnableVersion>) => {
      autobisect(event.sender, versions).catch(console.error);
    },
  );
}
