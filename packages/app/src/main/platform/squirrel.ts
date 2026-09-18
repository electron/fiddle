/**
 * Squirrel.Windows startup events, handled here rather than by
 * electron-squirrel-startup. main/index.ts calls `handleSquirrelStartup()`
 * before anything else; when it returns true, the app does nothing but this
 * and quits.
 *
 * - `--squirrel-install` / `--squirrel-updated`: create the shortcuts and
 *   register `electron-fiddle://` for the Squirrel stub.
 * - `--squirrel-uninstall`: remove both.
 * - `--squirrel-obsolete`: quit.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';

import { app } from 'electron';

export const PROTOCOL = 'electron-fiddle';

/**
 * Squirrel's stub launcher, `%LOCALAPPDATA%\electron-fiddle\electron-fiddle.exe`,
 * one folder above `app-<version>\electron-fiddle.exe`. It always starts the
 * newest installed version, so the protocol is registered for it.
 */
export function squirrelStubPath(execPath: string = process.execPath): string {
  return path.resolve(path.dirname(execPath), '..', 'electron-fiddle.exe');
}

type SquirrelEvent = 'install' | 'updated' | 'uninstall' | 'obsolete';

export function squirrelEvent(argv: readonly string[]): SquirrelEvent | undefined {
  const match = /^--squirrel-(install|updated|uninstall|obsolete)$/.exec(argv[1] ?? '');
  return match?.[1] as SquirrelEvent | undefined;
}

function runUpdateExe(args: string[]): Promise<void> {
  const updateExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
  return new Promise((resolve) => {
    try {
      spawn(updateExe, args, { detached: true })
        .on('close', () => resolve())
        .on('error', () => resolve());
    } catch {
      resolve();
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
