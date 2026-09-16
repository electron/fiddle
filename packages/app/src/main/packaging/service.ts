/**
 * Package and make with Electron Forge (REQUIREMENTS §17.6): the Forge
 * transform, `<pm> install`, `<pm> run package|make`, then reveal `out/`.
 *
 * Both run the fiddle's dependencies' install scripts and Forge itself, so they
 * need the same trust approval as a run. An unapproved fiddle is refused; there
 * is no scripts-off fallback, because Forge can't work that way.
 */
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { ElectronVersions } from '@electron/fiddle-core';
import { shell } from 'electron';

import type { VersionRef } from '../../fiddle/fiddle';
import { findMainEntry, PACKAGE_JSON, type FileMap } from '../../fiddle/files';
import { writeFiddleFolder } from '../../fiddle/folder';
import { forgeTransform, type ForgeTransformOptions } from '../../fiddle/forge';
import {
  buildInstallCommand,
  buildRunScriptCommand,
  findPackageManager,
  runCommand,
  type CommandLine,
  type PackageManager,
} from '../../fiddle/modules';
import { generatePackageJson } from '../../fiddle/package-json';
import { FiddleError } from '../../shared/errors';
import type { ReleaseRow } from '../../shared/stores';
import * as documents from '../documents/service';
import { tm } from '../i18n';
import { log } from '../log';
import type { StateHub } from '../state-hub';
import { toPackageName } from '../run/logic';
import { PM_INSTALL_URLS, type RunService } from '../run/service';
import type { VersionsService } from '../versions/service';

/** Same Forge range as "Save as Forge project". */
const FORGE_VERSION = '^7.8.0';

/** The Electron a Forge project gets. Window-free, shared with the headless CLI. */
interface ForgeElectron {
  /** The release to package with; unset for a local build. */
  release?: string;
  /** A local build's folder. */
  localPath?: string;
  releases: readonly ReleaseRow[];
  electronVersions: ElectronVersions;
}

/** Forge transform options: the nightly's ABI, a local build's path and the latest stable. */
export function forgeOptionsFor(electron: ForgeElectron): ForgeTransformOptions {
  const { release, localPath } = electron;
  const latestStable = electron.releases.find((r) => !r.version.includes('-'))?.version;
  const nightlyAbi = release?.includes('nightly')
    ? electron.electronVersions.getReleaseInfo(release)?.modules
    : undefined;
  return {
    forgeVersion: FORGE_VERSION,
    ...(nightlyAbi !== undefined ? { nightlyAbi } : {}),
    ...(localPath ? { localElectronPath: localPath } : {}),
    ...(latestStable ? { latestStableVersion: latestStable } : {}),
  };
}

/** The Electron for a fiddle's version: the release, or a local build's folder. */
export function forgeElectronFor(
  ref: VersionRef,
  versions: Pick<VersionsService, 'localBuild' | 'releases' | 'electronVersions'>,
): ForgeElectron {
  return {
    ...(ref.kind === 'release' ? { release: ref.version } : { localPath: versions.localBuild(ref.id)?.path }),
    releases: versions.releases(),
    electronVersions: versions.electronVersions,
  };
}

/** A fiddle as an Electron Forge project: its files, a generated `package.json`, then the Forge transform. */
export function forgeProject(
  fiddle: { files: FileMap; modules: Readonly<Record<string, string>>; name: string; author: string },
  electron: ForgeElectron,
): FileMap {
  const options = forgeOptionsFor(electron);
  const electronVersion = electron.release ?? options.latestStableVersion;
  const packageJson = generatePackageJson({
    name: toPackageName(fiddle.name),
    main: findMainEntry(Object.keys(fiddle.files)) ?? 'main.js',
    author: fiddle.author,
    modules: fiddle.modules,
    ...(electronVersion ? { electronVersion } : {}),
  });
  return forgeTransform({ ...fiddle.files, [PACKAGE_JSON]: packageJson }, options);
}

interface ForgeInstallOptions {
  ignoreScripts?: boolean;
  /** `sfw.mjs`: the install runs through Socket Firewall, like a run's module install (§4). */
  sfwPath?: string;
}

/** The commands of a Forge task: `<pm> install` (`node <sfw.mjs> <pm> install` with Socket Firewall), then `<pm> run package|make`. */
export function forgeTaskCommands(pm: PackageManager, task: 'package' | 'make', options: ForgeInstallOptions = {}): CommandLine[] {
  return [buildInstallCommand({ packageManager: pm, ...options }), buildRunScriptCommand(pm, task)];
}

/** `<pm> install`, then `<pm> run package|make` in `dir`. Resolves with the command that failed, if any. */
export async function runForgeTask(
  dir: string,
  pm: PackageManager,
  task: 'package' | 'make',
  options: ForgeInstallOptions & { env: NodeJS.ProcessEnv; signal?: AbortSignal; onOutput: (text: string) => void },
): Promise<{ command: string; code: number | string } | undefined> {
  const { ignoreScripts, sfwPath, ...commandOptions } = options;
  for (const line of forgeTaskCommands(pm, task, { ignoreScripts, sfwPath })) {
    const result = await runCommand(line, { cwd: dir, ...commandOptions, env: { ...commandOptions.env, ...line.env } });
    if (result.code !== 0) return { command: [line.command, ...line.args].join(' '), code: result.code ?? result.signal ?? '' };
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

  // The approval lists the packages with install scripts. The build needs
  // them, so an approval that left scripts off is asked again.
  const scripted = await documents.installScriptPackages(windowId);
  const trust = await documents.ensureTrusted(windowId, task, {
    packagesWithInstallScripts: scripted,
    requireScripts: scripted.length > 0,
  });
  if (!trust.approved) {
    runs.log(windowId, t('untrusted'), 'error');
    return;
  }
  if (scripted.length > 0 && !trust.allowScripts) {
    runs.log(windowId, t('scriptsRequired', { packages: scripted.join(', ') }), 'error');
    return;
  }
  // Exactly the approved fiddle is built, whatever the window loads during the awaits below.
  const fiddle = trust.fiddle;
  const name = hub.getWindow(windowId)?.fiddle.name ?? 'fiddle';

  const settings = hub.app.settings;
  const pm = settings.packageManager;
  const env = await runs.toolEnv();
  if (!(await findPackageManager(pm, { env }))) {
    runs.log(windowId, t('pmMissing', { pm, url: PM_INSTALL_URLS[pm] }), 'error');
    return;
  }

  const controller = runs.claim(windowId);
  runs.setState(windowId, { status: 'running', task, errors: [], result: undefined });
  try {
    const project = forgeProject(
      {
        files: { ...fiddle.files },
        modules: fiddle.modules,
        name,
        author: settings.packageAuthor || os.userInfo().username,
      },
      forgeElectronFor(fiddle.version, versions),
    );
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), `electron-fiddle-${task}-`));
    await writeFiddleFolder(dir, project);
    runs.log(windowId, task === 'package' ? t('packaging', { path: dir }) : t('making', { path: dir }));

    const failedCommand = await runForgeTask(dir, pm, task, {
      env,
      signal: controller.signal,
      onOutput: (text) => runs.logText(windowId, text),
      ignoreScripts: !trust.allowScripts,
      sfwPath: runs.sfwPath(windowId),
    });
    if (failedCommand) {
      runs.log(windowId, t('commandFailed', failedCommand), 'error');
      runs.setState(windowId, { result: 'failure' });
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
      runs.log(windowId, FiddleError.from(error).message, 'error');
    }
    runs.setState(windowId, { result: 'failure' });
  } finally {
    runs.release(windowId);
    runs.setState(windowId, { status: 'ready', task: 'run' });
  }
}
