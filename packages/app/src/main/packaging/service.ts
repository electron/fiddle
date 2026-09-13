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

import { shell } from 'electron';

import { findMainEntry, PACKAGE_JSON } from '../../fiddle/files';
import { writeFiddleFolder } from '../../fiddle/folder';
import { forgeTransform } from '../../fiddle/forge';
import { buildInstallCommand, buildRunScriptCommand, findPackageManager, runCommand } from '../../fiddle/modules';
import { generatePackageJson } from '../../fiddle/package-json';
import { FiddleError } from '../../shared/errors';
import * as documents from '../documents/service';
import { tm } from '../i18n';
import { log } from '../log';
import type { StateHub } from '../state-hub';
import { toPackageName } from '../run/logic';
import { PM_INSTALL_URLS, type RunService } from '../run/service';
import type { VersionsService } from '../versions/service';

/** Same Forge range as "Save as Forge project". */
export const FORGE_VERSION = '^7.8.0';

export async function packageFiddle(
  windowId: string,
  task: 'package' | 'make',
  deps: { hub: StateHub; runs: RunService; versions: VersionsService },
): Promise<void> {
  const { hub, runs, versions } = deps;
  const t = tm('mainRun');
  if (runs.isBusy(windowId)) return;
  runs.openConsole(windowId);

  const trust = await documents.ensureTrusted(windowId, task);
  if (!trust.approved) {
    runs.log(windowId, t('untrusted'), 'error');
    return;
  }

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
    const fiddle = documents.getFiddle(windowId);
    const files = documents.getFiddleFiles(windowId);
    const name = hub.getWindow(windowId)?.fiddle.name ?? 'fiddle';
    const ref = fiddle.version;
    const latestStable = versions.releases().find((r) => !r.version.includes('-'))?.version;
    const localPath = ref.kind === 'local' ? versions.localBuild(ref.id)?.path : undefined;
    const electronVersion = ref.kind === 'release' ? ref.version : latestStable;
    const nightlyAbi =
      ref.kind === 'release' && ref.version.includes('nightly')
        ? versions.electronVersions.getReleaseInfo(ref.version)?.modules
        : undefined;

    const packageJson = generatePackageJson({
      name: toPackageName(name),
      main: findMainEntry(Object.keys(files)) ?? 'main.js',
      author: settings.packageAuthor || os.userInfo().username,
      modules: fiddle.modules,
      ...(electronVersion ? { electronVersion } : {}),
    });
    const project = forgeTransform(
      { ...files, [PACKAGE_JSON]: packageJson },
      {
        forgeVersion: FORGE_VERSION,
        ...(nightlyAbi !== undefined ? { nightlyAbi } : {}),
        ...(localPath ? { localElectronPath: localPath } : {}),
        ...(latestStable ? { latestStableVersion: latestStable } : {}),
      },
    );
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), `electron-fiddle-${task}-`));
    await writeFiddleFolder(dir, project);
    runs.log(windowId, task === 'package' ? t('packaging', { path: dir }) : t('making', { path: dir }));

    const common = { cwd: dir, env, signal: controller.signal, onOutput: (text: string) => runs.logText(windowId, text) };
    for (const line of [buildInstallCommand({ packageManager: pm }), buildRunScriptCommand(pm, task)]) {
      const result = await runCommand(line, common);
      if (result.code !== 0) {
        const command = [line.command, ...line.args].join(' ');
        runs.log(windowId, t('commandFailed', { command, code: result.code ?? result.signal ?? '' }), 'error');
        runs.setState(windowId, { result: 'failure' });
        return;
      }
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
