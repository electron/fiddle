/** Binds the `Versions` and `Run` interfaces for one window. */
import { shell } from 'electron';

import { implement, Run, Versions } from '../../ipc/main';
import { ErrorCode, FiddleError } from '../../shared/errors';
import type { VersionRefValue } from '../../shared/stores';
import { messageBox } from '../dialogs';
import * as documents from '../documents/service';
import { tm } from '../i18n';
import type { IpcContext } from '../ipc';
import { log } from '../log';
import { installRunDevHooks } from './dev';

const t = tm('mainRun');

export function bindRunIpc(ctx: IpcContext): void {
  const { contents, windowId, services } = ctx;
  const { versions, runs, bisect, types } = services;
  const known = (version: string) => {
    if (!versions.release(version)) throw new FiddleError(ErrorCode.notFound, `Unknown version ${version}`);
  };

  /** Validates, sets the window's version, and downloads it if needed. */
  const setVersion = async (ref: VersionRefValue): Promise<number> => {
    if (runs.isBusy(windowId)) throw new FiddleError(ErrorCode.conflict, t('cannotChangeWhileRunning'));
    if (ref.kind === 'release') {
      const row = versions.release(ref.version);
      if (!row) throw new FiddleError(ErrorCode.notFound, t('versionUnknown', { version: ref.version }));
      if (!row.supported) {
        throw new FiddleError(ErrorCode.invalidArgument, t('versionUnavailable', { version: ref.version }));
      }
    } else if (!versions.localBuild(ref.id)) {
      throw new FiddleError(ErrorCode.notFound, `Unknown local build ${ref.id}`);
    }
    const rev = await documents.setFiddleVersion(windowId, ref);
    if (ref.kind === 'release' && versions.state(ref.version) !== 'installed') {
      void versions.install(ref.version).catch((error: unknown) => log.warn('download failed', error));
    }
    Versions.getDispatcher(contents)?.dispatchTypesChanged();
    return rev;
  };

  implement(Versions, contents, {
    GetReleases: () => versions.releases(),
    RefreshReleases: () => versions.refresh(),
    SetVersion: (ref) => setVersion(ref),
    Download: (version) => {
      known(version);
      void versions.install(version).catch((error: unknown) => log.warn(`downloading ${version} failed`, error));
    },
    Remove: (version) => versions.remove(version),
    DownloadAll: (list) => {
      void versions.downloadAll(list);
    },
    StopDownloadAll: () => versions.stopDownloadAll(),
    DeleteAll: () => versions.deleteAll(),
    AddLocalBuild: async () => {
      const id = await versions.addLocalBuild(windowId);
      if (!id) return false;
      // A folder that's already registered means "switch to it".
      await setVersion({ kind: 'local', id });
      return true;
    },
    RemoveLocalBuild: (id) => versions.removeLocalBuild(id),
    // Types for the window's version, or null.
    GetTypes: async () => {
      const ref = documents.getFiddle(windowId).version;
      if (ref.kind === 'release') return types.forRelease(ref.version);
      const build = versions.localBuild(ref.id);
      return build ? types.forLocal(build) : null;
    },
  });

  implement(Run, contents, {
    GetOutput: () => runs.output(windowId),
    ClearOutput: () => runs.clear(windowId),
    StartBisect: (good, bad, auto) => bisect.start(windowId, good, bad, auto),
    BisectGood: () => bisect.mark(windowId, 'good'),
    BisectBad: () => bisect.mark(windowId, 'bad'),
    BisectSkip: () => bisect.mark(windowId, 'skip'),
    StopBisect: () => bisect.stop(windowId),
    // Asks, then opens the bisect result on GitHub.
    OpenBisectCompare: async () => {
      const url = bisect.compareUrl(windowId);
      if (!url) return;
      const { response } = await messageBox(windowId, {
        type: 'question',
        message: t('openCompareMessage'),
        detail: url,
        buttons: [t('openCompareButton'), t('cancel')],
        defaultId: 0,
        cancelId: 1,
      });
      if (response === 0) await shell.openExternal(url);
    },
  });

  // Closing a window aborts its operations (but not downloads).
  contents.once('destroyed', () => {
    bisect.stop(windowId);
    runs.disposeWindow(windowId);
  });

  installRunDevHooks(services, windowId);
}
