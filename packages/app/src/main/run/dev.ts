/**
 * Dev-only hooks for headless checks with `yarn start:xvfb`. Compiled out of
 * production-mode builds and ignored in packaged apps (like window.ts's
 * FIDDLE_DEV_SCREENSHOT). All optional, applied to the first window:
 *
 *   FIDDLE_DEV_FIDDLE=<dir>            open this fiddle folder
 *   FIDDLE_DEV_LOCAL_BUILD=<dir>       register an Electron build folder and select it
 *   FIDDLE_DEV_RUN=1                   run the fiddle
 *   FIDDLE_DEV_RUN_SCREENSHOT=<png>    capture the window FIDDLE_DEV_RUN_DELAY ms
 *                                      (default 5000) later; FIDDLE_DEV_QUIT=1 then quits
 */
import fs from 'node:fs/promises';

import { app } from 'electron';

import * as documents from '../documents/service';
import { log } from '../log';
import type { Services } from '../services';
import { getWindow } from '../windows';

let installed = false;

/** FIDDLE_DEV_ELECTRON_FLAGS: extra flags for runs, e.g. `--no-sandbox` in a root container. */
export function devElectronFlags(): string[] {
  if (import.meta.env.MODE === 'production' || app.isPackaged) return [];
  return (process.env.FIDDLE_DEV_ELECTRON_FLAGS ?? '').split(' ').filter(Boolean);
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function installRunDevHooks({ hub, versions, runs }: Services, windowId: string): void {
  if (import.meta.env.MODE === 'production' || app.isPackaged || installed) return;
  const env = process.env;
  if (!env.FIDDLE_DEV_FIDDLE && !env.FIDDLE_DEV_LOCAL_BUILD && !env.FIDDLE_DEV_RUN) return;
  installed = true;

  void (async () => {
    for (let i = 0; i < 100 && !hub.getWindow(windowId); i++) await delay(100);
    await delay(1500);
    if (env.FIDDLE_DEV_FIDDLE) await documents.openFolderIn(windowId, env.FIDDLE_DEV_FIDDLE);
    if (env.FIDDLE_DEV_LOCAL_BUILD) {
      const id = versions.registerLocalBuild(env.FIDDLE_DEV_LOCAL_BUILD);
      await documents.setFiddleVersion(windowId, { kind: 'local', id });
    }
    if (env.FIDDLE_DEV_RUN === '1') void runs.run(windowId);
    const file = env.FIDDLE_DEV_RUN_SCREENSHOT;
    if (!file) return;
    await delay(Number(env.FIDDLE_DEV_RUN_DELAY ?? 5000));
    const image = await getWindow(windowId)?.webContents.capturePage();
    if (image) await fs.writeFile(file, image.toPNG());
    log.info('dev run screenshot saved', file);
    if (env.FIDDLE_DEV_QUIT === '1') {
      runs.stop(windowId);
      setTimeout(() => app.quit(), 1500);
    }
  })().catch((error: unknown) => log.error('dev run hooks failed', error));
}
