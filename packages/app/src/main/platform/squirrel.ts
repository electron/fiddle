import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { app } from 'electron';

import { log } from '../log';

export const PROTOCOL = 'electron-fiddle';

/**
 * Squirrel's stub launcher, one folder above `app-<version>\electron-fiddle.exe`.
 * It always starts the newest installed version, so the protocol is registered for it.
 */
export function squirrelStubPath(execPath: string = process.execPath): string {
  return path.resolve(path.dirname(execPath), '..', 'electron-fiddle.exe');
}

/**
 * What a shortcut to the app should start: the Squirrel stub when this is a Squirrel install, so it
 * survives updates, otherwise this executable (MSIX, a portable copy, dev).
 */
export function appLauncherPath(): string {
  if (process.platform === 'win32' && app.isPackaged && !process.windowsStore) {
    const stub = squirrelStubPath();
    if (fs.existsSync(stub)) return stub;
  }
  return process.execPath;
}

type SquirrelEvent = 'install' | 'updated' | 'uninstall' | 'obsolete';

export function squirrelEvent(argv: readonly string[]): SquirrelEvent | undefined {
  const match = /^--squirrel-(install|updated|uninstall|obsolete)$/.exec(argv[1] ?? '');
  return match?.[1] as SquirrelEvent | undefined;
}

function runUpdateExe(args: string[]): Promise<void> {
  const updateExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
  return new Promise((resolve) => {
    const failed = (error: unknown) => {
      log.warn('Update.exe failed', args, error);
      resolve();
    };
    try {
      spawn(updateExe, args, { detached: true })
        .on('close', () => resolve())
        .on('error', failed);
    } catch (error) {
      failed(error);
    }
  });
}

/** Handles a Squirrel event and quits when it's done. Returns true if there was one. */
export function handleSquirrelStartup(): boolean {
  if (process.platform !== 'win32') return false;
  const event = squirrelEvent(process.argv);
  if (!event) return false;

  const target = path.basename(process.execPath);
  const stub = squirrelStubPath();
  let work = Promise.resolve();
  if (event === 'install' || event === 'updated') {
    app.setAsDefaultProtocolClient(PROTOCOL, stub);
    work = runUpdateExe([`--createShortcut=${target}`]);
  } else if (event === 'uninstall') {
    app.removeAsDefaultProtocolClient(PROTOCOL, stub);
    work = runUpdateExe([`--removeShortcut=${target}`]);
  }
  void work.finally(() => app.quit());
  return true;
}
