import path from 'node:path';

import { app, net, safeStorage } from 'electron';

import { GitHubClient } from '../fiddle/github';
import { Run, Versions } from '../ipc/main';
import type { Platform } from '../shared/stores';
import { BisectService } from './bisect/service';
import { CommandRegistry } from './commands';
import { confirm } from './dialogs';
import {
  getStateStore,
  initDocuments,
  setFiddleModules,
  setFiddleVersion,
} from './documents/service';
import { CredentialStore, legacyTokenFile } from './github/credentials';
import { createDocumentsBridge } from './github/documents-bridge';
import { GitHubService } from './github/service';
import { tm } from './i18n';
import { log } from './log';
import { NpmClient, npmEndpoints } from './modules/npm-client';
import { ModulesService } from './modules/service';
import { installRunCleanupOnExit, RunService } from './run/service';
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

/** The versions and local builds the windows' fiddles use, and what runs in progress use (an auto bisect step). */
function activeVersions(
  hub: StateHub,
  runs: RunService,
): { releases: Set<string>; builds: Set<string> } {
  const releases = new Set<string>();
  const builds = new Set<string>();
  const refs = hub.windowIds.map(
    (windowId) => hub.getWindow(windowId)?.fiddle.versionRef,
  );
  for (const ref of [...refs, ...runs.versionsInUse()]) {
    if (ref?.kind === 'release') releases.add(ref.version);
    else if (ref?.kind === 'local') builds.add(ref.id);
  }
  return { releases, builds };
}

/**
 * Creates and starts the services. The release list is loaded before this
 * resolves (Documents needs the default version); the GitHub token check and
 * module normalization run in the background.
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
  rendererUrl: string;
}): Promise<Services> {
  const userData = app.getPath('userData');
  const cache = cachePaths();
  const fetch = (url: string, init?: RequestInit) => net.fetch(url, init);
  const contentsOf = (windowId: string) => getWindow(windowId)?.webContents;

  const versions: VersionsService = new VersionsService({
    hub,
    cache,
    userData,
    releasesUrl: getEndpoints().releasesJson,
    fetch,
    activeVersions: () => activeVersions(hub, runs),
    onRemoved: (version) => {
      types
        .removeVersion(version)
        .catch((error: unknown) => log.warn('removing cached types failed', error));
    },
  });
  const types = new TypesService({
    dir: cache.types,
    fetch,
    nodeVersionOf: (version) => versions.release(version)?.node,
    onLocalChange: (buildId) => {
      for (const windowId of hub.windowIds) {
        const ref = hub.getWindow(windowId)?.fiddle.versionRef;
        if (ref?.kind === 'local' && ref.id === buildId) typesChanged(windowId);
      }
    },
  });
  hub.onChange((change) => {
    if (change.store !== 'app') return;
    const builds = hub.app.versions?.localBuilds ?? [];
    types.retainWatches(new Set(builds.map((build) => build.id)));
  });
  const runs = new RunService(hub, versions, (windowId, lines) => {
    const contents = contentsOf(windowId);
    if (contents && !contents.isDestroyed())
      Run.getDispatcher(contents)?.dispatchOutput(lines);
  });
  installRunCleanupOnExit(runs);
  const typesChanged = (windowId: string) => {
    const contents = contentsOf(windowId);
    if (contents && !contents.isDestroyed())
      Versions.getDispatcher(contents)?.dispatchTypesChanged();
  };
  const bisect = new BisectService(hub, runs, versions, typesChanged);

  let noticeId = 0;
  // i18next types each key's own placeholders; the selector passes them as one record.
  const tv = tm('mainVersions') as (
    key: string,
    values?: Record<string, string>,
  ) => string;
  const versionSelector = new VersionSelector({
    versions,
    settings: () => hub.app.settings,
    showChannel: (channel) => {
      const { channels } = hub.app.settings;
      if (!channels.includes(channel))
        settings.service.set('channels', [...channels, channel]);
    },
    isBusy: (windowId) => {
      const step = hub.getWindow(windowId)?.run?.bisect;
      return (
        runs.isBusy(windowId) ||
        (step !== undefined && step !== null && step.result === null)
      );
    },
    getVersion: (windowId) => hub.getWindow(windowId)?.fiddle.versionRef,
    setVersion: (windowId, ref) => setFiddleVersion(windowId, ref),
    remember: (ref) => getStateStore().set((prev) => ({ ...prev, lastVersion: ref })),
    notify: (windowId, message) => {
      noticeId += 1;
      if (hub.getWindow(windowId))
        hub.updateWindow(windowId, { versionNotice: { id: noticeId, message } });
    },
    typesChanged,
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
    legacyFile: legacyTokenFile(userData),
    createClient: (token) => {
      const endpoints = getEndpoints();
      return new GitHubClient({
        token,
        apiBaseUrl: endpoints.githubApi,
        rawOrigins: [endpoints.gistRaw],
        allowLoopbackHttp: isTestMode(),
        fetch: (url, init) => net.fetch(url instanceof URL ? url.href : url, init),
      });
    },
    documents: createDocumentsBridge(hub),
    prefs: {
      get: () => ({
        asRevision: hub.app.settings.gistPublishAsRevision,
        ...(hub.app.settings.packageAuthor
          ? { author: hub.app.settings.packageAuthor }
          : {}),
      }),
      setVisibility: (isPublic) =>
        settings.service.set('gistVisibility', isPublic ? 'public' : 'secret'),
    },
    setLogin: (githubLogin) => hub.updateApp({ githubLogin }),
    log,
  });

  const npm = new NpmClient({
    fetch: (url, init) => net.fetch(url, init),
    endpoints: npmEndpoints(getEndpoints()),
  });
  const modules = new ModulesService(
    {
      getWindow: (windowId) => hub.getWindow(windowId),
      onChange: (listener) => hub.onChange(listener),
      setModules: setFiddleModules,
    },
    npm,
    (message, error) => log.warn(message, error),
  );

  initDocuments({
    hub,
    platform,
    versions,
    github,
    npm,
    createWindow: (windowId, init) =>
      createAppWindow({ services, url: rendererUrl, windowId, init }),
    onDocsExampleLoaded: (windowId) => {
      versionSelector
        .docsExampleLoaded(windowId)
        .catch((error: unknown) =>
          log.warn('selecting the docs example version failed', error),
        );
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

  await versions
    .init()
    .catch((error: unknown) => log.error('loading releases failed', error));
  github
    .init()
    .catch((error: unknown) => log.error('GitHub startup check failed', error));
  modules.watch();
  return services;
}
