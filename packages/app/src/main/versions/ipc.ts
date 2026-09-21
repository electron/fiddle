import { clipboard } from 'electron';

import { implement, Versions } from '../../ipc/main';
import * as documents from '../documents/service';
import type { IpcContext } from '../ipc';

export function bindVersionsIpc(ctx: IpcContext): void {
  const { contents, windowId, services } = ctx;
  const { versions, types, versionSelector: selector } = services;

  implement(Versions, contents, {
    GetReleases: () => versions.releases(),
    RefreshReleases: () => versions.refresh(),
    SetVersion: (ref) => selector.select(windowId, ref, { remember: true }),
    Download: async (version) => {
      await versions.install(version);
    },
    Remove: (version) => versions.remove(version),
    DownloadAll: (list) => {
      void versions.downloadAll(list);
    },
    StopDownloadAll: () => versions.stopDownloadAll(),
    DeleteAll: () => versions.deleteAll(),
    AddLocalBuild: () => selector.addLocalBuild(windowId),
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
    DismissNotice: (id) => selector.dismissNotice(windowId, id),
  });
}
