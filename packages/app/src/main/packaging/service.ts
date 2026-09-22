import path from 'node:path';

import { shell } from 'electron';

import appPackage from '../../../package.json';
import type { VersionRef } from '../../fiddle/fiddle';
import { findMainEntry, PACKAGE_JSON, type FileMap } from '../../fiddle/files';
import { writeFiddleFolder } from '../../fiddle/folder';
import { forgeTransform, type ForgeTransformOptions } from '../../fiddle/forge';
import {
  buildInstallCommand,
  buildRunScriptCommand,
  findPackageManager,
  PM_INSTALL_URLS,
  runCommand,
  type PackageManager,
} from '../../fiddle/modules';
import { generatePackageJson, osUserName } from '../../fiddle/package-json';
import type { ReleaseRow } from '../../shared/stores';
import * as documents from '../documents/service';
import { tm } from '../i18n';
import { errorMessage } from '../localize-error';
import { log } from '../log';
import { sfwPathFor } from '../platform/sfw';
import { makeRunDir, removeDir, toolEnv } from '../run/process';
import type { RunService } from '../run/service';
import type { StateHub } from '../state-hub';
import type { VersionsService } from '../versions/service';

/** Fiddle projects get the Forge the app is built with. */
const FORGE_VERSION = appPackage.devDependencies['@electron-forge/cli'];

/** The Electron a Forge project gets. Window-free, shared with the headless CLI. */
interface ForgeElectron {
  /** The release to package with; unset for a local build. */
  release?: string;
  /** A local build's folder. */
  localPath?: string;
  releases: readonly ReleaseRow[];
}

export function forgeOptionsFor(electron: ForgeElectron): ForgeTransformOptions {
  const { release, localPath } = electron;
  const latestStable = electron.releases.find((r) => !r.version.includes('-'))?.version;
  const nightlyAbi = release?.includes('nightly')
    ? electron.releases.find((r) => r.version === release)?.modules
    : undefined;
  return {
    forgeVersion: FORGE_VERSION,
    ...(nightlyAbi ? { nightlyAbi } : {}),
    ...(localPath ? { localElectronPath: localPath } : {}),
    ...(latestStable ? { latestStableVersion: latestStable } : {}),
  };
}

export function forgeElectronFor(
  ref: VersionRef,
  versions: Pick<VersionsService, 'localBuild' | 'releases'>,
): ForgeElectron {
  return {
    ...(ref.kind === 'release'
      ? { release: ref.version }
      : { localPath: versions.localBuild(ref.id)?.path }),
    releases: versions.releases(),
  };
}

/** A fiddle as an Electron Forge project: its files, a generated `package.json`, then the Forge transform. */
export function forgeProject(
  fiddle: {
    files: FileMap;
    modules: Readonly<Record<string, string>>;
    name: string;
    author: string;
  },
  electron: ForgeElectron,
): FileMap {
  const options = forgeOptionsFor(electron);
  const electronVersion = electron.release ?? options.latestStableVersion;
  const packageJson = generatePackageJson({
    name: fiddle.name,
    main: findMainEntry(Object.keys(fiddle.files)) ?? 'main.js',
    author: fiddle.author,
    modules: fiddle.modules,
    ...(electronVersion ? { electronVersion } : {}),
  });
  return forgeTransform({ ...fiddle.files, [PACKAGE_JSON]: packageJson }, options);
}

interface ForgeInstallOptions {
  ignoreScripts?: boolean;
  /** `sfw.mjs`: the install runs through Socket Firewall, like a run's module install. */
  sfwPath?: string;
}

/** `<pm> install` (through Socket Firewall if set), then `<pm> run package|make` in `dir`. Resolves with the command that failed, if any. */
export async function runForgeTask(
  dir: string,
  pm: PackageManager,
  task: 'package' | 'make',
  options: ForgeInstallOptions & {
    env: NodeJS.ProcessEnv;
    signal?: AbortSignal;
    onOutput: (text: string) => void;
  },
): Promise<{ command: string; code: number | string } | undefined> {
  const { ignoreScripts, sfwPath, ...commandOptions } = options;
  const install = buildInstallCommand({ packageManager: pm, ignoreScripts, sfwPath });
  for (const line of [install, buildRunScriptCommand(pm, task)]) {
    const result = await runCommand(line, {
      cwd: dir,
      ...commandOptions,
      env: { ...commandOptions.env, ...line.env },
    });
    if (result.code !== 0)
      return {
        command: [line.command, ...line.args].join(' '),
        code: result.code ?? result.signal ?? '',
      };
  }
  return undefined;
}

export async function packageFiddle(
  windowId: string,
  task: 'package' | 'make',
  deps: { hub: StateHub; runs: RunService; versions: VersionsService },
): Promise<void> {
  const { hub, runs, versions } = deps;
  const t = tm('mainRun');
  if (runs.isBusy(windowId)) return;
  runs.openConsole(windowId);
  // Busy from the start: the approval and the lookups below take a while, and another run must not begin meanwhile.
  const controller = runs.claim(windowId);
  runs.setState(windowId, { status: 'checking', task, errors: [], result: undefined });
  let dir: string | undefined;
  try {
    // The build needs install scripts, so an approval that left them off is asked again.
    const trust = await documents.ensureTrusted(windowId, task, { requireScripts: true });
    if (!trust.approved) {
      runs.log(windowId, t('untrusted'), 'error');
      return;
    }
    if (trust.scripted.length > 0 && !trust.allowScripts) {
      const packages = trust.scripted.join(', ');
      runs.log(windowId, t('scriptsRequired', { packages }), 'error');
      return;
    }
    // Exactly the approved fiddle is built, whatever the window loads during the awaits below.
    const fiddle = trust.fiddle;
    const name = hub.getWindow(windowId)?.fiddle.name ?? 'fiddle';

    const settings = hub.app.settings;
    const pm = settings.packageManager;
    const env = await toolEnv();
    if (!(await findPackageManager(pm, { env }))) {
      runs.log(windowId, t('pmMissing', { pm, url: PM_INSTALL_URLS[pm] }), 'error');
      return;
    }

    const sfwPath = await sfwPathFor(settings.socketFirewall);
    runs.setState(windowId, { status: 'running' });
    const project = forgeProject(
      {
        files: { ...fiddle.files },
        modules: fiddle.modules,
        name,
        author: settings.packageAuthor || osUserName(),
      },
      forgeElectronFor(fiddle.version, versions),
    );
    dir = await makeRunDir(`electron-fiddle-${task}-`);
    await writeFiddleFolder(dir, project, [], { keepEmpty: true });
    runs.log(
      windowId,
      task === 'package' ? t('packaging', { path: dir }) : t('making', { path: dir }),
    );

    const failedCommand = await runForgeTask(dir, pm, task, {
      env,
      signal: controller.signal,
      onOutput: (text) => runs.logText(windowId, text),
      ignoreScripts: !trust.allowScripts,
      sfwPath,
    });
    if (failedCommand) {
      runs.log(windowId, t('commandFailed', failedCommand), 'error');
      runs.setState(windowId, { result: 'failure' });
      await removeDir(dir);
      return;
    }
    const out = path.join(dir, 'out');
    runs.log(windowId, t('packageDone', { path: out }));
    runs.setState(windowId, { result: 'success' });
    const failed = await shell.openPath(out);
    if (failed) log.warn('revealing out/ failed', failed);
  } catch (error) {
    if (!controller.signal.aborted) {
      log.error(`${task} failed`, error);
      runs.log(windowId, errorMessage(error), 'error');
    }
    runs.setState(windowId, { result: 'failure' });
    // A project that failed to build is no use: don't leave its `node_modules` in the temp folder.
    if (dir) await removeDir(dir);
  } finally {
    runs.release(windowId);
    runs.setState(windowId, { status: 'ready', task: 'run' });
  }
}
