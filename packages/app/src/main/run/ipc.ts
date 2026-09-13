/** Binds the `Versions` and `Run` interfaces for one window. */
import type { WebContents } from 'electron';

import { implement, Run, Versions } from '../../ipc/main';
import { ErrorCode, FiddleError } from '../../shared/errors';
import { log } from '../log';
import type { StateHub } from '../state-hub';
import { getWindow } from '../windows';
import { installRunDevHooks } from './dev';
import { editorTypes, initRunServices, openBisectCompare, setVersion } from './index';

export function bindRunIpc({
  contents,
  windowId,
  hub,
}: {
  contents: WebContents;
  windowId: string;
  hub: StateHub;
}): void {
  const s = initRunServices(hub);
  const known = (version: string) => {
    if (!s.versions.release(version)) throw new FiddleError(ErrorCode.notFound, `Unknown version ${version}`);
  };

  implement(Versions, contents, {
    GetReleases: () => s.versions.releases(),
    RefreshReleases: () => s.versions.refresh(),
    SetVersion: (ref) => setVersion(s, windowId, ref),
    Download: (version) => {
      known(version);
      void s.versions.install(version).catch((error: unknown) => log.warn(`downloading ${version} failed`, error));
    },
    Remove: (version) => s.versions.remove(version),
    DownloadAll: (versions) => {
      void s.versions.downloadAll(versions);
    },
    StopDownloadAll: () => s.versions.stopDownloadAll(),
    DeleteAll: () => s.versions.deleteAll(),
    AddLocalBuild: async () => {
      const id = await s.versions.addLocalBuild(getWindow(windowId));
      if (!id) return false;
      // A folder that's already registered means "switch to it".
      await setVersion(s, windowId, { kind: 'local', id });
      return true;
    },
    RemoveLocalBuild: (id) => s.versions.removeLocalBuild(id),
    GetTypes: () => editorTypes(s, windowId),
  });

  implement(Run, contents, {
    GetOutput: () => s.runs.output(windowId),
    ClearOutput: () => s.runs.clear(windowId),
    StartBisect: (good, bad, auto) => s.bisect.start(windowId, good, bad, auto),
    BisectGood: () => s.bisect.mark(windowId, 'good'),
    BisectBad: () => s.bisect.mark(windowId, 'bad'),
    BisectSkip: () => s.bisect.mark(windowId, 'skip'),
    StopBisect: () => s.bisect.stop(windowId),
    OpenBisectCompare: () => openBisectCompare(s, windowId),
  });

  // Closing a window aborts its operations (but not downloads).
  contents.once('destroyed', () => {
    s.bisect.stop(windowId);
    s.runs.disposeWindow(windowId);
  });

  installRunDevHooks(s, windowId);
}
