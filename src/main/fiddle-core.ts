import { ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';

import { ElectronVersions, Installer, Runner } from '@electron/fiddle-core';
import {
  BrowserWindow,
  IpcMainEvent,
  IpcMainInvokeEvent,
  Menu,
  WebContents,
  app,
} from 'electron';

import { ELECTRON_DOWNLOAD_PATH, ELECTRON_INSTALL_PATH } from './constants';
import { cleanupDirectory, deleteUserData, saveFilesToTemp } from './files';
import { ipcMainManager } from './ipc';
import {
  ISOLATED_ACTIONS_SCHEME,
  getIsolatedRunButtonFrame,
} from './isolated-actions';
import { addModules, getIsPackageManagerInstalled } from './npm';
import { spawnInVM } from './tart';
import { getFiles } from './utils/get-files';
import { getStartFiddleOptions } from './utils/get-start-fiddle-options';
import { pushError, pushOutput, pushOutputLine } from './utils/push-output';
import { getLocalVersions } from './versions';
import {
  DownloadVersionParams,
  PACKAGE_NAME,
  PMOperationOptions,
  ProgressObject,
  RunResult,
  StartFiddleOptions,
} from '../interfaces';
import { IpcEvents } from '../ipc-events';
import { maybePlural } from '../utils/plural-maybe';

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

// Keep track of which fiddle process belongs to which WebContents
const fiddleProcesses = new WeakMap<WebContents, ChildProcess>();

// Keep track of active runs to prevent double runs
const activeRuns = new WeakMap<WebContents, Promise<RunResult>>();

const downloadingVersions = new Map<string, Promise<any>>();
const removingVersions = new Map<string, Promise<void>>();

/**
 * Whether the focused window's "Run Fiddle..." menu item should be
 * enabled. False if the focused window already has a fiddle running.
 */
export function isRunFiddleEnabled(): boolean {
  const focused = BrowserWindow.getFocusedWindow();
  return !focused || !activeRuns.has(focused.webContents);
}

/**
 * Update the enabled state of the "Run Fiddle..." menu item to reflect
 * whether the focused window already has a fiddle running. Used to
 * refresh the existing menu item between full menu rebuilds.
 */
export function updateRunFiddleMenuItem(): void {
  const menu = Menu.getApplicationMenu();
  const item = menu?.getMenuItemById('run-fiddle');
  if (!item) return;

  item.enabled = isRunFiddleEnabled();
}

/**
 * Installs the specified modules
 */
export async function installModules(
  webContents: WebContents,
  modulesPairs: [string, string][],
  options: PMOperationOptions,
): Promise<void> {
  const modules = modulesPairs.map(([pkg, version]) => `${pkg}@${version}`);

  // Install any modules the user added to the fiddle.
  if (modules.length > 0) {
    const pmInstalled = await getIsPackageManagerInstalled(
      options.packageManager,
    );
    if (!pmInstalled) {
      let message = `The ${maybePlural(`module`, modules)} ${modules.join(
        ', ',
      )} need to be installed, `;
      message += `but we could not find ${options.packageManager}. Fiddle requires Node.js and npm `;
      message += `to support the installation of modules not included in `;
      message += `Electron. Please visit https://nodejs.org to install Node.js `;
      message += `and npm, or https://classic.yarnpkg.com/lang/en/ to install Yarn`;

      pushOutput(webContents, message, { isNotPre: true });
      throw new Error('Package manager not installed');
    }

    pushOutput(
      webContents,
      `Installing node modules using ${
        options.packageManager
      }: ${modules.join(', ')}...`,
      { isNotPre: true },
    );

    const result = await addModules(
      {
        dir: options.dir,
        packageManager: options.packageManager,
        useSocketFirewall: options.useSocketFirewall,
      },
      ...modules,
    );
    if (result) pushOutputLine(webContents, result);
  }
}

/**
 * Drive the entire run lifecycle from main: ask the renderer for the
 * settings and files, write them to a temp directory, install modules,
 * spawn Electron, and clean everything up when the process exits.
 *
 * Resolves with a {@link RunResult} describing whether the run was
 * successful, failed, or was invalid.
 */
export async function startFiddle(
  webContents: WebContents,
): Promise<RunResult> {
  // Ignore concurrent run attempts from the same WebContents.
  if (!activeRuns.has(webContents)) {
    activeRuns.set(webContents, startFiddleImpl(webContents));
    updateRunFiddleMenuItem();
  }

  try {
    return await activeRuns.get(webContents)!;
  } finally {
    activeRuns.delete(webContents);
    updateRunFiddleMenuItem();
  }
}

async function startFiddleImpl(webContents: WebContents): Promise<RunResult> {
  let options: StartFiddleOptions;

  try {
    options = await getStartFiddleOptions(webContents);
  } catch {
    return RunResult.INVALID;
  }

  const {
    enableElectronLogging,
    env: rendererEnv,
    executionFlags,
    isKeepingUserDataDirs,
    modules,
    packageManager,
    runInVM,
    useSocketFirewall,
    version,
    vmImage,
  } = options;

  // The tart VM runner only works on macOS (Apple Silicon).
  const useVM = runInVM && process.platform === 'darwin';

  ipcMainManager.send(
    IpcEvents.FIDDLE_RUN,
    [{ installingModules: modules.length > 0 }],
    [webContents, getIsolatedRunButtonFrame(webContents)],
  );

  // Look up local Electron builds by version string. Local builds use a
  // version of the form `0.0.0-local.<timestamp>`, so only consult the
  // stored local versions when the version string contains `-local`.
  const localPath = version.includes('-local')
    ? getLocalVersions().find((v) => v.version === version)?.localPath
    : undefined;

  // Verify the executable exists on disk before using it.
  const resolvedExec = localPath ? Installer.getExecPath(localPath) : undefined;
  const useLocalPath = !!resolvedExec && fs.existsSync(resolvedExec);

  // Get the fiddle's files from the renderer.
  const files = new Map(
    (
      await getFiles(BrowserWindow.fromWebContents(webContents)!, [], {
        includeDependencies: false,
        includeElectron: false,
      })
    ).files,
  );

  // Pull the project name out of the fiddle's package.json — that's the
  // name Electron will use for its user-data dir, so that's what we
  // need to delete on cleanup.
  let appName: string | undefined;
  try {
    const pkg = JSON.parse(files.get(PACKAGE_NAME) ?? '{}');
    if (typeof pkg.name === 'string') appName = pkg.name;
  } catch {
    // package.json is malformed; skip user-data cleanup.
  }

  // Create the temp directory and write files into it. This is the only
  // place that creates the run directory — the renderer never sees it.
  pushOutputLine(webContents, 'Saving files to temp directory...');
  const dir = await saveFilesToTemp(files);
  pushOutputLine(webContents, `Saved files to ${dir}`);

  const cleanup = async () => {
    await cleanupDirectory(dir);
    if (!appName) return;
    if (isKeepingUserDataDirs) {
      console.log(
        `Cleanup: Not deleting data dir due to isKeepingUserDataDirs setting`,
      );
      return;
    }
    console.log(`Cleanup: Deleting data dir for ${appName}`);
    await deleteUserData(appName);
  };

  try {
    await installModules(webContents, modules, {
      dir,
      packageManager,
      useSocketFirewall,
    });
  } catch (error: any) {
    console.error('Runner: Could not install modules', error);

    pushError(webContents, 'Could not install modules', error);
    await cleanup();
    ipcMainManager.send(
      IpcEvents.FIDDLE_STOPPED,
      [null, null],
      [webContents, getIsolatedRunButtonFrame(webContents)],
    );
    return RunResult.FAILURE;
  }

  // Strip any CLI option containing a null byte, which can truncate
  // strings at the OS level.
  const safeOptions = [dir, '--inspect', ...executionFlags].filter(
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
    Object.entries(rendererEnv).filter(([key]) => !BLOCKED_ENV_KEYS.has(key)),
  );
  Object.assign(env, safeEnv);

  let child: ChildProcess;
  try {
    if (useVM) {
      // Resolve the on-disk Electron build so it can be mounted into the VM.
      // Local builds are already on disk; remote versions are installed here
      // (downloading first if necessary).
      const electronDir = useLocalPath
        ? localPath!
        : await installer.install(version);
      const execPath = Installer.getExecPath(electronDir);

      child = await spawnInVM({
        image: vmImage,
        fiddleDir: dir,
        electronDir,
        execPath,
        // safeOptions[0] is the host fiddle dir, which the VM runner remaps
        // to the guest mount point — pass only the flags that follow.
        flags: safeOptions.slice(1),
        env,
        onStatus: (line) => pushOutputLine(webContents, line),
      });
    } else {
      child = await runner.spawn(useLocalPath ? resolvedExec! : version, dir, {
        args: safeOptions,
        cwd: dir,
        env,
      });
    }
  } catch (error: any) {
    pushError(webContents, 'Failed to spawn Fiddle', error);
    await cleanup();
    ipcMainManager.send(
      IpcEvents.FIDDLE_STOPPED,
      [null, null],
      [webContents, getIsolatedRunButtonFrame(webContents)],
    );
    return RunResult.FAILURE;
  }
  fiddleProcesses.set(webContents, child);

  // Signal the renderer that module installation is done and the process is
  // running. Sent after fiddleProcesses.set() so that stopFiddle() will work
  // as soon as the button transitions to "Stop".
  ipcMainManager.send(
    IpcEvents.FIDDLE_MODULES_INSTALLED,
    [],
    [webContents, getIsolatedRunButtonFrame(webContents)],
  );

  pushOutputLine(
    webContents,
    `Electron v${version} started as "${appName}"${
      useVM ? ' in an isolated VM' : ''
    }`,
  );

  child.stdout?.on('data', (data) => pushOutput(webContents, data.toString()));
  child.stderr?.on('data', (data) => pushOutput(webContents, data.toString()));

  return new Promise<RunResult>((resolve) => {
    child.on('close', async (code, signal) => {
      fiddleProcesses.delete(webContents);
      await cleanup();

      let result: RunResult;
      if (typeof code !== 'number') {
        result = RunResult.FAILURE;
      } else {
        result = code === 0 ? RunResult.SUCCESS : RunResult.FAILURE;
      }

      ipcMainManager.send(
        IpcEvents.FIDDLE_STOPPED,
        [code, signal],
        [webContents, getIsolatedRunButtonFrame(webContents)],
      );

      resolve(result);
    });
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
        [window.webContents, getIsolatedRunButtonFrame(window.webContents)],
      );
    }
  });

  runner = await Runner.create({ installer, versions });

  // Refresh the "Run Fiddle..." menu item when window focus changes so it
  // reflects the focused window's run state.
  app.on('browser-window-focus', updateRunFiddleMenuItem);

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
              [webContents, getIsolatedRunButtonFrame(webContents)],
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
    async (event: IpcMainInvokeEvent) => {
      const { sender, senderFrame } = event;

      // START_FIDDLE is only valid when it originates from isolated-actions://
      if (
        senderFrame &&
        new URL(senderFrame.url).protocol === `${ISOLATED_ACTIONS_SCHEME}:`
      ) {
        return await startFiddle(sender);
      }
    },
  );
  ipcMainManager.on(IpcEvents.STOP_FIDDLE, (event: IpcMainEvent) => {
    stopFiddle(event.sender);
  });
}
