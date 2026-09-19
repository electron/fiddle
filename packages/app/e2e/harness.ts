/** Vitest glue for specs. See ./README.md. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, beforeEach } from 'vitest';

import type { AppState, WindowState } from '../src/shared/stores.ts';
import { launchApp, type FiddleApp, type LaunchOptions } from './driver.ts';
import { startFixtureServer, type FixtureServer } from './fixtures/server.ts';

export { FIXTURE_GIST_ID, role, text, type FiddleApp } from './driver.ts';
export type { AppState, WindowState };

export interface AppHandle {
  (): FiddleApp;
  /** The app's fixture server, for asserting on the requests it received. */
  fixtures(): FixtureServer;
}

/**
 * One app per spec file, launched before the first test and closed after the last. A failing test
 * prints diagnostics and keeps the temp dir; an isolation violation fails the file.
 */
export function useApp(options: LaunchOptions = {}): AppHandle {
  let app: FiddleApp | undefined;
  let fixtures: FixtureServer | undefined;

  beforeAll(async () => {
    fixtures = options.fixtures ?? (await startFixtureServer());
    app = await launchApp({ ...options, fixtures });
  });

  beforeEach((context) => {
    context.onTestFailed(async () => {
      if (!app) return;
      app.markFailed();
      console.error(await app.diagnostics(context.task.name));
    });
  });

  afterAll(async () => {
    try {
      await app?.assertClean();
    } finally {
      await app?.close();
      if (!options.fixtures) await fixtures?.close();
    }
  });

  const get = () => {
    if (!app)
      throw new Error('useApp(): the app is only available inside tests and hooks');
    return app;
  };
  return Object.assign(get, {
    fixtures: () => {
      if (!fixtures)
        throw new Error('useApp(): fixtures are only available inside tests and hooks');
      return fixtures;
    },
  });
}

/** The Window store of `window` (default: the first window). */
export async function windowState(
  app: FiddleApp,
  window: number | string = 0,
): Promise<WindowState> {
  return (await app.stores(window)).window as WindowState;
}

export async function appState(app: FiddleApp): Promise<AppState> {
  return (await app.stores(0)).app as AppState;
}

/** A folder in the app's temp dir (removed with it), holding `files` (name → content). */
export function makeFolder(
  app: FiddleApp,
  name: string,
  files: Record<string, string> = {},
): string {
  const dir = path.join(app.testDir ?? os.tmpdir(), 'work', name);
  fs.mkdirSync(dir, { recursive: true });
  for (const [file, content] of Object.entries(files))
    fs.writeFileSync(path.join(dir, file), content);
  return dir;
}

export function readJson<T = Record<string, unknown>>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

/** What the app recorded for native dialogs, newest last. */
export async function dialogMessages(app: FiddleApp): Promise<string[]> {
  return (await app.dialogs()).map((dialog) =>
    String(dialog.options.message ?? dialog.options.title ?? ''),
  );
}

/** URLs passed to `shell.openExternal`. */
export async function openedUrls(app: FiddleApp): Promise<string[]> {
  return (await app.sideEffects())
    .filter((effect) => effect.kind === 'shell.openExternal')
    .map((effect) => String(effect.args[0]));
}
