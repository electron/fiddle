import {
  assertModuleSpec,
  isFloatingVersion,
  isValidPackageName,
} from '../../fiddle/modules';
import { ErrorCode, FiddleError } from '../../shared/errors';
import type { FiddleState } from '../../shared/stores';
import { tm } from '../i18n';
import { log } from '../log';
import type { ChangeListener } from '../state-hub';

/** The parts of the StateHub and Documents this service needs. */
export interface ModulesHub {
  getWindow(windowId: string): { fiddle: Pick<FiddleState, 'modules'> } | undefined;
  onChange(listener: ChangeListener): () => void;
  /**
   * Documents' `setFiddleModules`, so a change marks the fiddle dirty.
   * `normalized` (a floating version pinned to the latest) doesn't. Returns the Window rev.
   */
  setModules(
    windowId: string,
    modules: Record<string, string>,
    normalized: boolean,
  ): number;
}

interface LatestVersionSource {
  latestVersion(name: string): Promise<string>;
}

export class ModulesService {
  readonly #hub: ModulesHub;
  readonly #npm: LatestVersionSource;
  /** `windowId name spec` keys being pinned, or that failed to be (not retried). */
  readonly #seen = new Set<string>();

  constructor(hub: ModulesHub, npm: LatestVersionSource) {
    this.#hub = hub;
    this.#npm = npm;
  }

  /** Adds `name` at `version`, or at its latest version. Returns the Window rev. */
  async add(windowId: string, name: string, version?: string): Promise<number> {
    const resolved = await this.#resolve(name, version);
    return this.#write(windowId, { ...this.#modules(windowId), [name]: resolved });
  }

  async setVersion(windowId: string, name: string, version: string): Promise<number> {
    if (!Object.hasOwn(this.#modules(windowId), name)) {
      throw new FiddleError(ErrorCode.notFound, `${name} is not in this fiddle`, {
        name,
      });
    }
    const resolved = await this.#resolve(name, version);
    return this.#write(windowId, { ...this.#modules(windowId), [name]: resolved });
  }

  remove(windowId: string, name: string): number {
    const { [name]: _removed, ...rest } = this.#modules(windowId);
    return this.#write(windowId, rest);
  }

  /** Pins floating versions whenever a window's modules change. */
  watch(): () => void {
    return this.#hub.onChange((change) => {
      if (change.store === 'window') void this.normalize(change.windowId);
    });
  }

  /** Replaces every floating version (`*`, `latest`) in the window with the package's latest. Ranges and other tags stay as declared. */
  async normalize(windowId: string): Promise<void> {
    const modules = this.#hub.getWindow(windowId)?.fiddle.modules ?? {};
    const pending = Object.entries(modules).filter(([name, spec]) => {
      const key = `${windowId} ${name} ${spec}`;
      if (!isFloatingVersion(spec) || this.#seen.has(key)) return false;
      this.#seen.add(key);
      return true;
    });
    await Promise.all(
      pending.map(async ([name, spec]) => {
        try {
          const latest = await this.#npm.latestVersion(name);
          const current = this.#hub.getWindow(windowId)?.fiddle.modules;
          // Only if nobody changed it meanwhile.
          if (current?.[name] !== spec) return;
          this.#write(windowId, { ...current, [name]: latest }, true);
          this.#seen.delete(`${windowId} ${name} ${spec}`);
        } catch (error) {
          log.warn(`could not normalize ${name}@${spec}`, error);
        }
      }),
    );
  }

  async #resolve(name: string, version: string | undefined): Promise<string> {
    if (!isValidPackageName(name)) {
      throw new FiddleError(
        ErrorCode.invalidArgument,
        tm('mainModules')('invalidPackageName', { name }),
        { name },
      );
    }
    if (version !== undefined) assertModuleSpec(name, version);
    if (version !== undefined && !isFloatingVersion(version)) return version;
    return this.#npm.latestVersion(name);
  }

  #modules(windowId: string): Record<string, string> {
    const win = this.#hub.getWindow(windowId);
    if (!win)
      throw new FiddleError(ErrorCode.notFound, `Window ${windowId} is not registered`);
    return win.fiddle.modules;
  }

  #write(windowId: string, modules: Record<string, string>, normalized = false): number {
    if (!this.#hub.getWindow(windowId))
      throw new FiddleError(ErrorCode.notFound, `Window ${windowId} is not registered`);
    return this.#hub.setModules(windowId, modules, normalized);
  }
}
