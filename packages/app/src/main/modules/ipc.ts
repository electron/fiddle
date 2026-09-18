import { implement, Modules } from '../../ipc/main';
import type { IpcContext } from '../ipc';

export function bindModulesIpc({
  contents,
  windowId,
  services: { npm, modules },
}: IpcContext): void {
  implement(Modules, contents, {
    SearchPackages: (query) => npm.search(query),
    GetPackageVersions: (name) => npm.versions(name),
    AddModule: (name, version) => modules.add(windowId, name, version ?? undefined),
    SetModuleVersion: (name, version) => modules.setVersion(windowId, name, version),
    RemoveModule: (name) => modules.remove(windowId, name),
  });
}
