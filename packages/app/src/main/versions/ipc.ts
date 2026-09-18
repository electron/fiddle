/**
 * Also falls back when the window loads or restores a version it can't use.
 * Every version choice goes through `services.versionSelector`.
 */
import { clipboard } from 'electron';

import { implement, Versions } from '../../ipc/main';
import { ErrorCode, FiddleError } from '../../shared/errors';
import type { VersionRefValue } from '../../shared/stores';
import * as documents from '../documents/service';
import type { IpcContext } from '../ipc';
import { log } from '../log';
import { sameVersion } from './selection';

export function bindVersionsIpc(ctx: IpcContext): void {
  const { contents, windowId, services } = ctx;
  const { hub, versions, types, versionSelector: selector } = services;
  const known = (version: string) => {
    if (!versions.release(version))
      throw new FiddleError(ErrorCode.notFound, `Unknown version ${version}`);
  };

  implement(Versions, contents, {
    GetReleases: () => versions.releases(),
    RefreshReleases: () => versions.refresh(),
    SetVersion: async (ref) =>
      (await selector.select(windowId, ref, { remember: true })) ??
      hub.getWindow(windowId)?.rev ??
      0,
    Download: (version) => {
      known(version);
      void versions
        .install(version)
        .catch((error: unknown) => log.warn(`downloading ${version} failed`, error));
    },
    Remove: (version) => versions.remove(version),
    DownloadAll: (list) => {
      void versions.downloadAll(list);
    },
    StopDownloadAll: () => versions.stopDownloadAll(),
    DeleteAll: () => versions.deleteAll(),
    AddLocalBuild: async () => {
      // A folder that's already registered asks "Switch to …?" first.
      const id = await versions.addLocalBuild(windowId);
      if (!id) return false;
      await selector.select(windowId, { kind: 'local', id }, { remember: true });
      return true;
    },
    RemoveLocalBuild: (id) => versions.removeLocalBuild(id),
    GetTypes: async () => {
      const ref = documents.getFiddle(windowId).version;
      if (ref.kind === 'release') return types.forRelease(ref.version);
      const build = versions.localBuild(ref.id);
      return build ? types.forLocal(build) : null;
    },
    RetryDownload: () => selector.retry(windowId),
    CopyVersion: () => {
      clipboard.writeText(versions.label(documents.getFiddle(windowId).version));
    },
    DismissNotice: (id) => {
      if (hub.getWindow(windowId)?.versionNotice?.id === id)
        hub.updateWindow(windowId, { versionNotice: null });
    },
  });

  // Whenever the window's version changes (a restore, a folder load, a
  // draft), check that it can use it.
  let seen: VersionRefValue | undefined;
  const stop = hub.onChange((change) => {
    if (change.store !== 'window' || change.windowId !== windowId) return;
    const ref = hub.getWindow(windowId)?.fiddle.versionRef;
    if (!ref || (seen && sameVersion(seen, ref))) return;
    seen = ref;
    selector
      .validate(windowId)
      .catch((error: unknown) => log.warn('checking the window version failed', error));
  });
  contents.once('destroyed', () => {
    stop();
  });
}
