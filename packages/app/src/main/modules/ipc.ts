/** Binds the `Modules` interface (npm search and the fiddle's modules) for one window. */
import { net, type WebContents } from 'electron';

import { implement, Modules } from '../../ipc/main';
import { log } from '../log';
import type { StateHub } from '../state-hub';
import { getEndpoints } from '../test-mode';
import { NpmClient, npmEndpoints } from './npm-client';
import { ModulesService } from './service';

let shared: { npm: NpmClient; service: ModulesService } | undefined;

/** One npm client (and its caches) and one modules service for the whole app. */
function services(hub: StateHub): { npm: NpmClient; service: ModulesService } {
  if (!shared) {
    const npm = new NpmClient({
      fetch: (url, init) => net.fetch(url, init),
      // Test mode points these at the fixture server.
      endpoints: npmEndpoints(getEndpoints()),
    });
    const service = new ModulesService(hub, npm, (message, error) => log.warn(message, error));
    service.watch();
    shared = { npm, service };
  }
  return shared;
}

export function bindModulesIpc(contents: WebContents, windowId: string, hub: StateHub): void {
  const { npm, service } = services(hub);
  implement(Modules, contents, {
    SearchPackages: (query) => npm.search(query),
    GetPackageVersions: (name) => npm.versions(name),
    AddModule: (name, version) => service.add(windowId, name, version ?? undefined),
    SetModuleVersion: (name, version) => service.setVersion(windowId, name, version),
    RemoveModule: (name) => service.remove(windowId, name),
  });
}
