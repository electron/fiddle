/**
 * The Versions and run slice's services, created once at startup
 * (`initRunServices`) and shared by the IPC bindings and command handlers.
 */
import { app, dialog, net, shell } from 'electron';

import { Run, Versions } from '../../ipc/main';
import { ErrorCode, FiddleError } from '../../shared/errors';
import type { EditorTypes, VersionRefValue } from '../../shared/stores';
import { BisectService } from '../bisect/service';
import * as documents from '../documents/service';
import { tm } from '../i18n';
import { log } from '../log';
import type { StateHub } from '../state-hub';
import { TypesService } from '../types/service';
import { cachePaths } from '../versions/paths';
import { RELEASES_URL, VersionsService } from '../versions/service';
import { getWindow } from '../windows';
import { RunService } from './service';

export interface RunServices {
  hub: StateHub;
  versions: VersionsService;
  runs: RunService;
  bisect: BisectService;
  types: TypesService;
  /** Resolves once the release list is loaded. */
  ready: Promise<void>;
}

let services: RunServices | undefined;

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

function isStable(version: string): boolean {
  return !version.includes('-');
}

export function initRunServices(hub: StateHub): RunServices {
  if (services) return services;
  const cache = cachePaths();
  const fetch = (url: string) => net.fetch(url);
  // A local release list for tests and offline development only.
  const releasesUrl = (!app.isPackaged && process.env.FIDDLE_RELEASES_URL) || RELEASES_URL;

  const notifyTypes = (buildId: string) => {
    for (const windowId of hub.windowIds) {
      const ref = hub.getWindow(windowId)?.fiddle.versionRef;
      const contents = getWindow(windowId)?.webContents;
      if (ref?.kind === 'local' && ref.id === buildId && contents) {
        Versions.getDispatcher(contents)?.dispatchTypesChanged();
      }
    }
  };
  const service: VersionsService = new VersionsService({
    hub,
    cache,
    userData: app.getPath('userData'),
    releasesUrl,
    fetch,
    activeVersions: () => activeVersions(hub),
    onRemoved: (version) => void types.removeVersion(version),
  });
  const types = new TypesService({
    dir: cache.types,
    fetch,
    nodeVersionOf: (version) => service.release(version)?.node,
    onLocalChange: notifyTypes,
  });
  const runs = new RunService(hub, service, (windowId, lines) => {
    const contents = getWindow(windowId)?.webContents;
    if (contents && !contents.isDestroyed()) Run.getDispatcher(contents)?.dispatchOutput(lines);
  });
  const bisect = new BisectService(hub, runs, service);

  documents.setDocumentHooks({
    defaultVersion: () => {
      const latest = service.releases().find((r) => r.supported && isStable(r.version));
      return { kind: 'release', version: latest?.version ?? process.versions.electron };
    },
    isReleasedMajor: (major) =>
      service.releases().some((r) => isStable(r.version) && Number.parseInt(r.version, 10) === major),
    isUsableVersion: (version) => service.release(version)?.supported ?? false,
  });

  const ready = service.init().catch((error: unknown) => log.error('loading releases failed', error));
  services = { hub, versions: service, runs, bisect, types, ready };
  return services;
}

export function getRunServices(): RunServices {
  if (!services) throw new FiddleError(ErrorCode.unavailable, 'Versions and run are not started');
  return services;
}

/** `Versions.SetVersion`: validates, sets the window's version, and downloads it if needed. */
export async function setVersion(s: RunServices, windowId: string, ref: VersionRefValue): Promise<number> {
  if (s.runs.isBusy(windowId)) {
    throw new FiddleError(ErrorCode.conflict, tm('mainRun')('cannotChangeWhileRunning'));
  }
  if (ref.kind === 'release') {
    const row = s.versions.release(ref.version);
    if (!row) throw new FiddleError(ErrorCode.notFound, tm('mainRun')('versionUnknown', { version: ref.version }));
    if (!row.supported) {
      throw new FiddleError(ErrorCode.invalidArgument, tm('mainRun')('versionUnavailable', { version: ref.version }));
    }
  } else if (!s.versions.localBuild(ref.id)) {
    throw new FiddleError(ErrorCode.notFound, `Unknown local build ${ref.id}`);
  }
  const rev = await documents.setFiddleVersion(windowId, ref);
  if (ref.kind === 'release' && s.versions.state(ref.version) !== 'installed') {
    void s.versions.install(ref.version).catch((error: unknown) => log.warn('download failed', error));
  }
  const contents = getWindow(windowId)?.webContents;
  if (contents) Versions.getDispatcher(contents)?.dispatchTypesChanged();
  return rev;
}

/** `Versions.GetTypes`: types for the window's version, or null. */
export async function editorTypes(s: RunServices, windowId: string): Promise<EditorTypes | null> {
  const ref = documents.getFiddle(windowId).version;
  if (ref.kind === 'local') {
    const build = s.versions.localBuild(ref.id);
    return build ? s.types.forLocal(build) : null;
  }
  return s.types.forRelease(ref.version);
}

/** Asks, then opens the bisect result on GitHub. */
export async function openBisectCompare(s: RunServices, windowId: string): Promise<void> {
  const url = s.bisect.compareUrl(windowId);
  if (!url) return;
  const t = tm('mainRun');
  const win = getWindow(windowId);
  const box = {
    type: 'question' as const,
    message: t('openCompareMessage'),
    detail: url,
    buttons: [t('openCompareButton'), t('cancel')],
    defaultId: 0,
    cancelId: 1,
  };
  const { response } = win ? await dialog.showMessageBox(win, box) : await dialog.showMessageBox(box);
  if (response === 0) await shell.openExternal(url);
}
