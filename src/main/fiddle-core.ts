import { ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { ElectronVersions, Installer, Runner } from '@electron/fiddle-core';
import {
  BrowserWindow,
  IpcMainEvent,
  IpcMainInvokeEvent,
  WebContents,
} from 'electron';

import { ELECTRON_DOWNLOAD_PATH, ELECTRON_INSTALL_PATH } from './constants';
import { ipcMainManager } from './ipc';
import {
  DownloadVersionParams,
  ProgressObject,
  StartFiddleParams,
} from '../interfaces';
import { IpcEvents } from '../ipc-events';

let installer: Installer;
let runner: Runner;

// Keys that must not be overridden by renderer-supplied env vars because they
// affect dynamic-linker behaviour of the spawned process in ways that go
// beyond what the fiddle code itself can already do.
const BLOCKED_ENV_KEYS = new Set([
  'LD_PRELOAD',
  'DYLD_INSERT_LIBRARIES',
  'DYLD_FRAMEWORK_PATH',
  'DYLD_LIBRARY_PATH',
]);

/**
 * Returns true if `dir` resolves to a path inside the OS temp directory.
 */
function isInsideTempDir(dir: unknown): dir is string {
  if (typeof dir !== 'string') return false;
  const tmpDir = fs.realpathSync(os.tmpdir());
  const resolved = fs.realpathSync(path.resolve(dir));
  return resolved.startsWith(tmpDir + path.sep) || resolved === tmpDir;
}

// Keep track of which fiddle process belongs to which WebContents
const fiddleProcesses = new WeakMap<WebContents, ChildProcess>();

const downloadingVersions = new Map<string, Promise<any>>();
const removingVersions = new Map<string, Promise<void>>();

/**
 * Push to the renderer's run output.
 */
function pushOutput(webContents: WebContents, message: string): void {
  ipcMainManager.send(IpcEvents.FIDDLE_RUNNER_OUTPUT, [message], webContents);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function pushOutputLine(webContents: WebContents, message: string): void {
  pushOutput(webContents, `${message}\n`);
}

/**
 * Start running an Electron fiddle.
 */
export async function startFiddle(
  webContents: WebContents,
  params: StartFiddleParams,
): Promise<void> {
  const { dir, enableElectronLogging, localPath, options, version } = params;

  // Guard 1: working directory must be inside the OS temp directory.
  if (!isInsideTempDir(dir)) {
    throw new Error(`startFiddle: dir must be inside the temp directory`);
  }

  // Guard 2: determine whether to use the local path by verifying the
  // executable exists on disk — do not trust the renderer-supplied
  // isValidBuild flag.
  const resolvedExec = localPath ? Installer.getExecPath(localPath) : undefined;
  const useLocalPath = !!resolvedExec && fs.existsSync(resolvedExec);

  // Guard 3: strip any CLI option containing a null byte, which can
  // truncate strings at the OS level.
  const safeOptions = options.filter(
    (opt) => typeof opt === 'string' && !opt.includes('\0'),
  );

  const env = { ...process.env };

  if (enableElectronLogging) {
    env.ELECTRON_ENABLE_LOGGING = 'true';
    env.ELECTRON_DEBUG_NOTIFICATIONS = 'true';
    env.ELECTRON_ENABLE_STACK_DUMPING = 'true';
  } else {
    delete env.ELECTRON_ENABLE_LOGGING;
    delete env.ELECTRON_DEBUG_NOTIFICATIONS;
    delete env.ELECTRON_ENABLE_STACK_DUMPING;
  }

  const safeEnv = Object.fromEntries(
    Object.entries(params.env).filter(([key]) => !BLOCKED_ENV_KEYS.has(key)),
  );
  Object.assign(env, safeEnv);

  const child = await runner.spawn(
    useLocalPath ? resolvedExec! : version,
    dir,
    { args: safeOptions, cwd: dir, env },
  );
  fiddleProcesses.set(webContents, child);

  child.stdout?.on('data', (data) => pushOutput(webContents, data.toString()));
  child.stderr?.on('data', (data) => pushOutput(webContents, data.toString()));

  child.on('close', async (code, signal) => {
    fiddleProcesses.delete(webContents);

    ipcMainManager.send(IpcEvents.FIDDLE_STOPPED, [code, signal], webContents);
  });
}

/**
 * Stop a currently running Electron fiddle.
 */
export function stopFiddle(webContents: WebContents): void {
  const child = fiddleProcesses.get(webContents);
  child?.kill();

  if (child) {
    // If the child process is still alive 1 second after we've
    // attempted to kill it by normal means, kill it forcefully.
    setTimeout(() => {
      if (child.exitCode === null) {
        child.kill('SIGKILL');
      }
    }, 1000);
  }
}

export async function setupFiddleCore(versions: ElectronVersions) {
  // For managing downloads and versions for electron
  installer = new Installer({
    electronDownloads: ELECTRON_DOWNLOAD_PATH,
    electronInstall: ELECTRON_INSTALL_PATH,
  });

  // Broadcast state changes to all windows
  installer.on('state-changed', (event) => {
    for (const window of BrowserWindow.getAllWindows()) {
      ipcMainManager.send(
        IpcEvents.VERSION_STATE_CHANGED,
        [event],
        window.webContents,
      );
    }
  });

  runner = await Runner.create({ installer, versions });

  ipcMainManager.on(
    IpcEvents.GET_VERSION_STATE,
    (event: IpcMainEvent, version: string) => {
      event.returnValue = installer.state(version);
    },
  );
  ipcMainManager.handle(
    IpcEvents.DOWNLOAD_VERSION,
    async (
      event: IpcMainInvokeEvent,
      version: string,
      opts?: Partial<DownloadVersionParams>,
    ) => {
      const webContents = event.sender;

      if (removingVersions.has(version)) {
        throw new Error('Version is being removed');
      }

      if (!downloadingVersions.has(version)) {
        const promise = installer.ensureDownloaded(version, {
          ...opts,
          progressCallback: (progress: ProgressObject) => {
            ipcMainManager.send(
              IpcEvents.VERSION_DOWNLOAD_PROGRESS,
              [version, progress],
              webContents,
            );
          },
        });

        downloadingVersions.set(version, promise);
      }

      try {
        await downloadingVersions.get(version);
      } finally {
        downloadingVersions.delete(version);
      }
    },
  );
  ipcMainManager.handle(
    IpcEvents.REMOVE_VERSION,
    async (_: IpcMainInvokeEvent, version: string) => {
      if (downloadingVersions.has(version)) {
        throw new Error('Version is being downloaded');
      }

      if (!removingVersions.has(version)) {
        removingVersions.set(version, installer.remove(version));
      }

      try {
        await removingVersions.get(version);
        return installer.state(version);
      } finally {
        removingVersions.delete(version);
      }
    },
  );
  ipcMainManager.handle(
    IpcEvents.START_FIDDLE,
    async (event: IpcMainInvokeEvent, params: StartFiddleParams) => {
      await startFiddle(event.sender, params);
    },
  );
  ipcMainManager.on(IpcEvents.STOP_FIDDLE, (event: IpcMainEvent) => {
    stopFiddle(event.sender);
  });
}
