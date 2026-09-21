import type { VersionRef } from '../../fiddle/fiddle';
import type { ReleaseChannel } from '../../fiddle/versions';
import { ErrorCode, FiddleError } from '../../shared/errors';
import { confirm } from '../dialogs';
import * as documents from '../documents/service';
import { tm } from '../i18n';
import { log } from '../log';
import type { StateHub } from '../state-hub';
import {
  firstUsableVersion,
  hiddenChannel,
  sameVersion,
  versionProblem,
  type VersionLookup,
} from './selection';
import type { VersionsService } from './service';

export interface VersionSelectorDeps {
  hub: Pick<StateHub, 'app' | 'getWindow' | 'updateWindow' | 'onChange'>;
  versions: Pick<
    VersionsService,
    | 'releases'
    | 'release'
    | 'localBuilds'
    | 'localBuild'
    | 'isInstalled'
    | 'install'
    | 'addLocalBuild'
  >;
  /** The settings service, to turn a release channel on. */
  settings: { set(key: 'channels', value: ReleaseChannel[]): unknown };
  /** Running, packaging, making or bisecting: the window keeps its version. */
  isBusy: (windowId: string) => boolean;
  /** The window's version changed: its editor types did too. */
  typesChanged: (windowId: string) => void;
}

const tv = tm('mainVersions');

const CHANNEL_TITLES = {
  stable: 'showStableTitle',
  beta: 'showBetaTitle',
  nightly: 'showNightlyTitle',
} as const satisfies Record<ReleaseChannel, string>;

/** Why a window can't use `ref`, as the error to throw; undefined when it can. */
export function versionProblemError(
  ref: VersionRef,
  lookup: VersionLookup,
): FiddleError | undefined {
  const problem = versionProblem(ref, lookup);
  if (!problem) return undefined;
  if (ref.kind === 'local') {
    const build = lookup.localBuild(ref.id);
    const text = build
      ? tv('localBuildMissing', { name: build.name })
      : tv('localBuildUnknown');
    return new FiddleError(ErrorCode.notFound, text);
  }
  const { version } = ref;
  return problem === 'unsupported'
    ? new FiddleError(ErrorCode.invalidArgument, tv('versionUnsupported', { version }))
    : new FiddleError(ErrorCode.notFound, tv('versionUnknown', { version }));
}

/** Every version choice: `SetVersion`, fallbacks, docs examples and the last-used version. */
export class VersionSelector {
  readonly #deps: VersionSelectorDeps;
  /** Downloads started here, and the windows waiting on each. */
  readonly #pending = new Map<string, Set<string>>();
  readonly #validating = new Set<string>();
  #noticeId = 0;

  constructor(deps: VersionSelectorDeps) {
    this.#deps = deps;
  }

  /** Resolves with the Window rev, or 0 once the window has gone. */
  async select(
    windowId: string,
    ref: VersionRef,
    options: { remember?: boolean } = {},
  ): Promise<number> {
    const deps = this.#deps;
    if (deps.isBusy(windowId))
      throw new FiddleError(ErrorCode.conflict, tv('cannotChange'));
    const problem = versionProblemError(ref, deps.versions);
    if (problem) throw problem;
    const current = this.#version(windowId);
    if (!current || !sameVersion(current, ref)) {
      const rev = await documents.setFiddleVersion(windowId, ref);
      // Another pick got in while this one's template loaded, or the window closed.
      const now = this.#version(windowId);
      if (!now || !sameVersion(now, ref)) return rev;
      deps.typesChanged(windowId);
    }
    if (options.remember)
      documents.getStateStore().set((prev) => ({ ...prev, lastVersion: ref }));
    this.#download(windowId, ref);
    return deps.hub.getWindow(windowId)?.rev ?? 0;
  }

  /** Adds the folder the user picks and selects it. False when nothing was added. */
  async addLocalBuild(windowId: string): Promise<boolean> {
    // A folder that's already registered asks "Switch to …?" first.
    const id = await this.#deps.versions.addLocalBuild(windowId);
    if (id) await this.select(windowId, { kind: 'local', id }, { remember: true });
    return id !== undefined;
  }

  /** A restore, a folder load or a draft can bring a version this window can't use: check each new one. Returns the unsubscribe. */
  watch(windowId: string): () => void {
    let seen: VersionRef | undefined;
    return this.#deps.hub.onChange((change) => {
      if (change.store !== 'window' || change.windowId !== windowId) return;
      const ref = this.#version(windowId);
      if (!ref || (seen && sameVersion(seen, ref))) return;
      seen = ref;
      this.validate(windowId).catch((error: unknown) =>
        log.warn('checking the window version failed', error),
      );
    });
  }

  /** A version that's unknown, can't run here, or is a local build with no binary falls back to a usable one, with a notice. */
  async validate(windowId: string): Promise<void> {
    const deps = this.#deps;
    const ref = this.#version(windowId);
    if (
      !ref ||
      this.#validating.has(windowId) ||
      deps.isBusy(windowId) ||
      deps.versions.releases().length === 0
    ) {
      return;
    }
    const problem = versionProblemError(ref, deps.versions);
    if (!problem) return;
    this.#validating.add(windowId);
    try {
      await this.#fallBack(windowId, ref, problem.message, false);
    } finally {
      this.#validating.delete(windowId);
    }
  }

  /** Back online: downloads the window's version if it still isn't. */
  retry(windowId: string): void {
    const ref = this.#version(windowId);
    if (ref && !versionProblem(ref, this.#deps.versions)) this.#download(windowId, ref);
  }

  dismissNotice(windowId: string, id: number): void {
    const { hub } = this.#deps;
    if (hub.getWindow(windowId)?.versionNotice?.id === id)
      hub.updateWindow(windowId, { versionNotice: null });
  }

  /** Offers to show the example's hidden release channel, then selects its version. */
  async docsExampleLoaded(windowId: string): Promise<void> {
    const deps = this.#deps;
    const loaded = this.#version(windowId);
    if (loaded?.kind === 'release' && deps.versions.release(loaded.version)) {
      const { channels } = deps.hub.app.settings;
      const channel = hiddenChannel(loaded.version, channels);
      if (channel) {
        const show = await confirm(windowId, {
          message: tv(CHANNEL_TITLES[channel]),
          detail: tv('showChannelDetail', { version: loaded.version }),
          ok: tv('showChannelOk'),
        });
        if (show) deps.settings.set('channels', [...channels, channel]);
      }
    }
    // The version may have changed during the prompt: a fallback, or the user.
    const ref = this.#version(windowId);
    if (!ref) return;
    try {
      await this.select(windowId, ref);
    } catch {
      await this.validate(windowId);
    }
  }

  #version(windowId: string): VersionRef | undefined {
    return this.#deps.hub.getWindow(windowId)?.fiddle.versionRef;
  }

  /** Shows an error toast in the window. */
  #notify(windowId: string, message: string): void {
    const { hub } = this.#deps;
    this.#noticeId += 1;
    if (hub.getWindow(windowId))
      hub.updateWindow(windowId, { versionNotice: { id: this.#noticeId, message } });
  }

  async #fallBack(
    windowId: string,
    from: VersionRef,
    problem: string,
    installedOnly: boolean,
  ): Promise<void> {
    const { hub, versions, typesChanged } = this.#deps;
    const fallback = firstUsableVersion(
      {
        rows: versions.releases(),
        localBuilds: versions.localBuilds(),
        settings: hub.app.settings,
        isInstalled: (version) => versions.isInstalled(version),
      },
      { installedOnly, exclude: from },
    );
    if (!fallback) {
      this.#notify(windowId, problem);
      return;
    }
    await documents.setFiddleVersion(windowId, fallback);
    typesChanged(windowId);
    const label =
      fallback.kind === 'release'
        ? tv('electronVersion', { version: fallback.version })
        : (versions.localBuild(fallback.id)?.name ?? fallback.id);
    this.#notify(windowId, tv('fallback', { problem, fallback: label }));
    this.#download(windowId, fallback);
  }

  #download(windowId: string, ref: VersionRef): void {
    if (ref.kind !== 'release') return;
    const deps = this.#deps;
    const { version } = ref;
    if (deps.versions.isInstalled(version)) return;
    const waiting = this.#pending.get(version);
    if (waiting) {
      waiting.add(windowId);
      return;
    }
    const windows = new Set([windowId]);
    this.#pending.set(version, windows);
    deps.versions.install(version).then(
      () => this.#pending.delete(version),
      (error: unknown) => {
        this.#pending.delete(version);
        for (const id of windows) {
          const current = this.#version(id);
          // The window moved on to another version or closed. A busy window
          // keeps its version, and a run reports its own download errors.
          if (
            current?.kind !== 'release' ||
            current.version !== version ||
            deps.isBusy(id)
          )
            continue;
          this.#fallBack(id, current, FiddleError.from(error).message, true).catch(
            (failure: unknown) =>
              log.warn('falling back after a failed download failed', failure),
          );
        }
      },
    );
  }
}
