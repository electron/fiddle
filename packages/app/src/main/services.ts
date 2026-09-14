/**
 * Every main-process service, created once at startup by main/index.ts with
 * explicit dependencies. The one `Services` object is passed to the IPC
 * binders, the command handlers, the menu, the OS integration and the e2e
 * harness. Documents is a module (./documents/service.ts) that gets its
 * dependencies here, in `initDocuments`.
 */
import path from 'node:path';

import { app, net, safeStorage } from 'electron';

import { GitHubClient } from '../fiddle/github';
import { Run, Versions } from '../ipc/main';
import type { Platform } from '../shared/stores';
import { BisectService } from './bisect/service';
import { CommandRegistry } from './commands';
import { confirm } from './dialogs';
import { getStateStore, initDocuments, setFiddleModules, setFiddleVersion } from './documents/service';
import { CredentialStore } from './github/credentials';
import { createDocumentsBridge } from './github/documents-bridge';
import { createGistPrefs } from './github/prefs';
import { GitHubService } from './github/service';
import { tm } from './i18n';
import { log } from './log';
import { NpmClient, npmEndpoints } from './modules/npm-client';
import { ModulesService } from './modules/service';
import { RunService } from './run/service';
import type { SettingsContext } from './settings';
import type { StateHub } from './state-hub';
import { getEndpoints, isTestMode } from './test-mode';
import { TypesService } from './types/service';
import { createOnboarding } from './ux/onboarding';
import { cachePaths } from './versions/paths';
import { VersionSelector } from './versions/select';
import { VersionsService } from './versions/service';
import { createAppWindow } from './window';
import { getWindow } from './windows';

export interface Services {
  hub: StateHub;
  registry: CommandRegistry;
  platform: Platform;
  settings: SettingsContext;
  versions: VersionsService;
  /** Every version choice: `SetVersion`, fallbacks, docs examples and the last-used version. */
  versionSelector: VersionSelector;
  types: TypesService;
  runs: RunService;
  bisect: BisectService;
  github: GitHubService;
  npm: NpmClient;
  modules: ModulesService;
  onboarding: ReturnType<typeof createOnboarding>;
}

/** Versions each window uses; they can't be removed. */
function activeVersions(hub: StateHub): { releases: Set<string>; builds: Set<string> } {
  const releases = new Set<string>();
  const builds = new Set<string>();
  for (const windowId of hub.windowIds) {
    const ref = hub.getWindow(windowId)?.fiddle.versionRef;
    if (ref?.kind === 'release') releases.add(ref.version);
    else if (ref?.kind === 'local') builds.add(ref.id);
  }
  return { releases, builds };
}

/**
 * Creates the services and starts them: the release list is loaded before
 * this resolves (Documents asks it for the default version), and the GitHub
 * token check and module normalization run in the background.
 */
export async function createServices({
  hub,
  settings,
  platform,
  rendererUrl,
}: {
  hub: StateHub;
  settings: SettingsContext;
  platform: Platform;
  /** What app windows load. */
  rendererUrl: string;
}): Promise<Services> {
  const userData = app.getPath('userData');
  const cache = cachePaths();
  const fetch = (url: string) => net.fetch(url);
  const contentsOf = (windowId: string) => getWindow(windowId)?.webContents;

  const versions: VersionsService = new VersionsService({
    hub,
    cache,
    userData,
    releasesUrl: getEndpoints().releasesJson,
    fetch,
    activeVersions: () => activeVersions(hub),
    onRemoved: (version) => void types.removeVersion(version),
  });
  const types = new TypesService({
    dir: cache.types,
    fetch,
    nodeVersionOf: (version) => versions.release(version)?.node,
    // A watched local build's types changed: tell the windows that use it.
    onLocalChange: (buildId) => {
      for (const windowId of hub.windowIds) {
        const ref = hub.getWindow(windowId)?.fiddle.versionRef;
        const contents = contentsOf(windowId);
        if (ref?.kind === 'local' && ref.id === buildId && contents) Versions.getDispatcher(contents)?.dispatchTypesChanged();
      }
    },
  });
  const runs = new RunService(hub, versions, (windowId, lines) => {
    const contents = contentsOf(windowId);
    if (contents && !contents.isDestroyed()) Run.getDispatcher(contents)?.dispatchOutput(lines);
  });
  const bisect = new BisectService(hub, runs, versions);

  let noticeId = 0;
  // i18next types each key's own placeholders; the selector passes them as one record.
  const tv = tm('mainVersions') as (key: string, values?: Record<string, string>) => string;
  const versionSelector = new VersionSelector({
    versions,
    settings: () => hub.app.settings,
    showChannel: (channel) => {
      const { channels } = hub.app.settings;
      if (!channels.includes(channel)) settings.service.set('channels', [...channels, channel]);
    },
    isBusy: (windowId) => {
      const step = hub.getWindow(windowId)?.run?.bisect;
      return runs.isBusy(windowId) || (step !== undefined && step !== null && step.result === null);
    },
    getVersion: (windowId) => hub.getWindow(windowId)?.fiddle.versionRef,
    setVersion: (windowId, ref) => setFiddleVersion(windowId, ref),
    remember: (ref) => getStateStore().set((prev) => ({ ...prev, lastVersion: ref })),
    notify: (windowId, message) => {
      noticeId += 1;
      if (hub.getWindow(windowId)) hub.updateWindow(windowId, { versionNotice: { id: noticeId, message } });
    },
    typesChanged: (windowId) => {
      const contents = contentsOf(windowId);
      if (contents && !contents.isDestroyed()) Versions.getDispatcher(contents)?.dispatchTypesChanged();
    },
    confirm: (windowId, options) => confirm(windowId, options),
    text: (key, values) => tv(key, values),
    warn: (message, error) => log.warn(message, error),
  });

  // The token stays in this process; the App store only gets the login.
  const github = new GitHubService({
    store: new CredentialStore({
      file: path.join(userData, 'credentials', 'github'),
      safeStorage,
      platform: process.platform,
    }),
    createClient: (token) => {
      const endpoints = getEndpoints();
      return new GitHubClient({
        token,
        apiBaseUrl: endpoints.githubApi,
        rawOrigins: [endpoints.gistRaw],
        allowLoopbackHttp: isTestMode(),
      });
    },
    documents: createDocumentsBridge(hub),
    prefs: createGistPrefs(hub, settings.service),
    setLogin: (githubLogin) => hub.updateApp({ githubLogin }),
    log,
  });

  const npm = new NpmClient({ fetch: (url, init) => net.fetch(url, init), endpoints: npmEndpoints(getEndpoints()) });
  const modules = new ModulesService(
    { getWindow: (windowId) => hub.getWindow(windowId), onChange: (listener) => hub.onChange(listener), setModules: setFiddleModules },
    npm,
    (message, error) => log.warn(message, error),
  );

  initDocuments({
    hub,
    platform,
    versions,
    github,
    createWindow: (windowId, init) => createAppWindow({ services, url: rendererUrl, windowId, init }),
    onDocsExampleLoaded: (windowId) => {
      versionSelector
        .docsExampleLoaded(windowId)
        .catch((error: unknown) => log.warn('selecting the docs example version failed', error));
    },
  });

  const services: Services = {
    hub,
    registry: new CommandRegistry(hub),
    platform,
    settings,
    versions,
    versionSelector,
    types,
    runs,
    bisect,
    github,
    npm,
    modules,
    onboarding: createOnboarding(getStateStore()),
  };

  await versions.init().catch((error: unknown) => log.error('loading releases failed', error));
  github.init().catch((error: unknown) => log.error('GitHub startup check failed', error));
  modules.watch();
  return services;
}
