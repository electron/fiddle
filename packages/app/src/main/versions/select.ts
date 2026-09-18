/**
 * Choosing a window's Electron version:
 *
 * - `select` is `Versions.SetVersion`: it checks the version, sets it,
 *   remembers it for new windows when the user picked it, and downloads it
 *   if needed.
 * - `validate` runs when a window loads or restores a version it can't use
 *   (not in the release list, can't run here, or a local build whose binary
 *   is gone). It falls back to the first usable version and says so.
 * - A failed download falls back to the first usable version that's already
 *   downloaded, because another download would likely fail too. Without one
 *   the version stays and the error shows. `retry` downloads it again once
 *   the computer is back online.
 * - `docsExampleLoaded` offers to show a docs example's hidden release
 *   channel, then selects its version the way `select` does.
 *
 * No Electron imports: services.ts wires it to Documents, the StateHub and
 * native dialogs, so it runs under plain Node in tests.
 */
import type { VersionRef } from '../../fiddle/fiddle';
import type { ReleaseChannel } from '../../fiddle/versions';
import { ErrorCode, FiddleError } from '../../shared/errors';
import type { LocalBuild, ReleaseRow } from '../../shared/stores';
import type { VersionFilterSettings } from './releases';
import {
  firstUsableVersion,
  hiddenChannel,
  sameVersion,
  versionProblem,
  type VersionProblem,
} from './selection';

/** Keys in the `mainVersions` namespace. */
export type SelectorText =
  | 'cannotChange'
  | 'versionUnknown'
  | 'versionUnsupported'
  | 'localBuildUnknown'
  | 'localBuildMissing'
  | 'downloadFailed'
  | 'fallback'
  | 'electronVersion'
  | 'showStableTitle'
  | 'showBetaTitle'
  | 'showNightlyTitle'
  | 'showChannelDetail'
  | 'showChannelOk';

export interface VersionSelectorDeps {
  versions: {
    releases(): readonly ReleaseRow[];
    release(version: string): ReleaseRow | undefined;
    localBuilds(): readonly LocalBuild[];
    localBuild(id: string): LocalBuild | undefined;
    isInstalled(version: string): boolean;
    install(version: string): Promise<unknown>;
  };
  settings: () => VersionFilterSettings;
  /** Turns a release channel on in the settings. */
  showChannel: (channel: ReleaseChannel) => void;
  /** Running, packaging, making or bisecting: the window keeps its version. */
  isBusy: (windowId: string) => boolean;
  /** The window's version, or undefined once it's closed. */
  getVersion: (windowId: string) => VersionRef | undefined;
  /** Sets the window's version (Documents). Resolves with the Window rev. */
  setVersion: (windowId: string, ref: VersionRef) => Promise<number>;
  /** Remembers the version the user picked, for new windows. */
  remember: (ref: VersionRef) => void;
  /** Shows an error toast in the window. */
  notify: (windowId: string, message: string) => void;
  /** The window's version changed: its editor types did too. */
  typesChanged: (windowId: string) => void;
  confirm: (
    windowId: string,
    options: { message: string; detail: string; ok: string },
  ) => Promise<boolean>;
  text: (key: SelectorText, values?: Record<string, string>) => string;
  warn: (message: string, error?: unknown) => void;
}

const CHANNEL_TITLES = {
  stable: 'showStableTitle',
  beta: 'showBetaTitle',
  nightly: 'showNightlyTitle',
} as const satisfies Record<ReleaseChannel, SelectorText>;

export class VersionSelector {
  readonly #deps: VersionSelectorDeps;
  /** Downloads started here, and the windows waiting on each. */
  readonly #pending = new Map<string, Set<string>>();
  readonly #validating = new Set<string>();

  constructor(deps: VersionSelectorDeps) {
    this.#deps = deps;
  }

  /** `SetVersion`. Resolves with the Window rev if the version changed. */
  async select(
    windowId: string,
    ref: VersionRef,
    options: { remember?: boolean } = {},
  ): Promise<number | undefined> {
    const deps = this.#deps;
    if (deps.isBusy(windowId))
      throw new FiddleError(ErrorCode.conflict, deps.text('cannotChange'));
    const problem = versionProblem(ref, deps.versions);
    if (problem) {
      const code =
        problem === 'unsupported' ? ErrorCode.invalidArgument : ErrorCode.notFound;
      throw new FiddleError(code, this.#problemText(ref, problem));
    }
    let rev: number | undefined;
    const current = deps.getVersion(windowId);
    if (!current || !sameVersion(current, ref)) {
      rev = await deps.setVersion(windowId, ref);
      deps.typesChanged(windowId);
    }
    if (options.remember) deps.remember(ref);
    this.#download(windowId, ref);
    return rev;
  }

  /** Falls back if the window's version is one it can't use. */
  async validate(windowId: string): Promise<void> {
    const deps = this.#deps;
    const ref = deps.getVersion(windowId);
    if (
      !ref ||
      this.#validating.has(windowId) ||
      deps.isBusy(windowId) ||
      deps.versions.releases().length === 0
    ) {
      return;
    }
    const problem = versionProblem(ref, deps.versions);
    if (!problem) return;
    this.#validating.add(windowId);
    try {
      await this.#fallBack(windowId, ref, this.#problemText(ref, problem), false);
    } finally {
      this.#validating.delete(windowId);
    }
  }

  /** Back online: downloads the window's version if it still isn't. */
  retry(windowId: string): void {
    const ref = this.#deps.getVersion(windowId);
    if (ref && !versionProblem(ref, this.#deps.versions)) this.#download(windowId, ref);
  }

  /** After a docs example loads: offers to show its hidden channel, then selects its version. */
  async docsExampleLoaded(windowId: string): Promise<void> {
    const deps = this.#deps;
    const loaded = deps.getVersion(windowId);
    if (loaded?.kind === 'release' && deps.versions.release(loaded.version)) {
      const channel = hiddenChannel(loaded.version, deps.settings().channels);
      if (channel) {
        const show = await deps.confirm(windowId, {
          message: deps.text(CHANNEL_TITLES[channel]),
          detail: deps.text('showChannelDetail', { version: loaded.version }),
          ok: deps.text('showChannelOk'),
        });
        if (show) deps.showChannel(channel);
      }
    }
    // The version may have changed during the prompt: a fallback, or the user.
    const ref = deps.getVersion(windowId);
    if (!ref) return;
    try {
      await this.select(windowId, ref);
    } catch {
      await this.validate(windowId);
    }
  }

  async #fallBack(
    windowId: string,
    from: VersionRef,
    problem: string,
    installedOnly: boolean,
  ): Promise<void> {
    const deps = this.#deps;
    const fallback = firstUsableVersion(
      {
        rows: deps.versions.releases(),
        localBuilds: deps.versions.localBuilds(),
        settings: deps.settings(),
        isInstalled: (version) => deps.versions.isInstalled(version),
      },
      { installedOnly, exclude: from },
    );
    if (!fallback) {
      deps.notify(windowId, problem);
      return;
    }
    await deps.setVersion(windowId, fallback);
    deps.typesChanged(windowId);
    deps.notify(
      windowId,
      deps.text('fallback', { problem, fallback: this.#label(fallback) }),
    );
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
      () => {
        this.#pending.delete(version);
      },
      (error: unknown) => {
        this.#pending.delete(version);
        deps.warn(`downloading ${version} failed`, error);
        for (const id of windows) {
          this.#downloadFailed(id, version, error).catch((failure: unknown) =>
            deps.warn('falling back after a failed download failed', failure),
          );
        }
      },
    );
  }

  async #downloadFailed(
    windowId: string,
    version: string,
    error: unknown,
  ): Promise<void> {
    const deps = this.#deps;
    const current = deps.getVersion(windowId);
    // The window moved on to another version or closed. A busy window keeps
    // its version, and a run reports its own download errors.
    if (
      current?.kind !== 'release' ||
      current.version !== version ||
      deps.isBusy(windowId)
    )
      return;
    const problem = deps.text('downloadFailed', {
      version,
      message: FiddleError.from(error).message,
    });
    await this.#fallBack(windowId, current, problem, true);
  }

  #problemText(ref: VersionRef, problem: VersionProblem): string {
    const deps = this.#deps;
    if (ref.kind === 'local') {
      const name = deps.versions.localBuild(ref.id)?.name;
      return problem === 'localMissing' && name
        ? deps.text('localBuildMissing', { name })
        : deps.text('localBuildUnknown');
    }
    return deps.text(
      problem === 'unsupported' ? 'versionUnsupported' : 'versionUnknown',
      { version: ref.version },
    );
  }

  #label(ref: VersionRef): string {
    return ref.kind === 'release'
      ? this.#deps.text('electronVersion', { version: ref.version })
      : (this.#deps.versions.localBuild(ref.id)?.name ?? ref.id);
  }
}
