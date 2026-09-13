/**
 * Settings in main: validates changes, keeps `settings.json` sparse (only
 * values that differ from the defaults) and puts the effective settings in
 * the `App` store. Every change returns the `App` rev that includes it, which
 * the renderer uses to reconcile its optimistic updates (REQUIREMENTS §3).
 *
 * No Electron imports.
 */
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { ErrorCode, FiddleError } from '../../shared/errors';
import {
  defaultSettings,
  fromSparse,
  parseSetting,
  settingKeys,
  toSparse,
  type SettingKey,
  type Settings,
  type SparseSettings,
} from '../../shared/settings';
import type { AppState } from '../../shared/stores';
import type { JsonStore, JsonStoreNotice } from '../persistence/json-store';
import type { AppPatch } from '../state-hub';

export const SETTINGS_VERSION = 1;

/** The part of the StateHub settings needs. */
export interface SettingsHub {
  readonly app: AppState;
  updateApp(patch: AppPatch): number;
}

function isSettingKey(key: string): key is SettingKey {
  return (settingKeys as string[]).includes(key);
}

/** Keeps the keys this app version doesn't know, so they round-trip. */
function unknownKeys(sparse: SparseSettings): Record<string, unknown> {
  return Object.fromEntries(Object.entries(sparse).filter(([key]) => !isSettingKey(key)));
}

/** Per-key validation of an outside settings object. Invalid and unknown keys are dropped. */
export function sanitizeSettings(data: Record<string, unknown>): {
  settings: Settings;
  dropped: string[];
} {
  const sparse: Record<string, unknown> = {};
  const dropped: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === 'schemaVersion') continue;
    const parsed = isSettingKey(key) ? parseSetting(key, value) : undefined;
    if (parsed) sparse[key] = parsed.value;
    else dropped.push(key);
  }
  return { settings: fromSparse(sparse), dropped };
}

export class SettingsService {
  readonly #hub: SettingsHub;
  readonly #store: JsonStore<SparseSettings>;

  constructor(hub: SettingsHub, store: JsonStore<SparseSettings>) {
    this.#hub = hub;
    this.#store = store;
  }

  get settings(): Settings {
    return this.#hub.app.settings;
  }

  get file(): string {
    return this.#store.file;
  }

  set(key: string, value: unknown): number {
    if (!isSettingKey(key)) throw new FiddleError(ErrorCode.invalidArgument, `Unknown setting: ${key}`);
    const parsed = parseSetting(key, value);
    if (!parsed) {
      throw new FiddleError(ErrorCode.invalidArgument, `Invalid value for setting "${key}"`, {
        key,
      });
    }
    return this.replace({ ...this.settings, [key]: parsed.value });
  }

  reset(key: string): number {
    if (!isSettingKey(key)) throw new FiddleError(ErrorCode.invalidArgument, `Unknown setting: ${key}`);
    return this.set(key, defaultSettings[key]);
  }

  /** Replaces every setting, e.g. after an import. */
  replace(settings: Settings): number {
    this.#store.set((prev) => ({ ...unknownKeys(prev), ...toSparse(settings) }));
    return this.#hub.updateApp({ settings });
  }

  /** Applies settings.json after it changed on disk, without writing it back. */
  applyFromDisk(sparse: SparseSettings): number {
    return this.#hub.updateApp({ settings: fromSparse(sparse) });
  }

  /** The sparse settings, as export writes them. */
  exportData(): Record<string, unknown> {
    return { schemaVersion: SETTINGS_VERSION, ...toSparse(this.settings) };
  }

  addStorageNotice(notice: JsonStoreNotice): number {
    return this.#hub.updateApp({
      storageNotices: [
        ...this.#hub.app.storageNotices,
        { id: randomUUID(), kind: notice.kind, file: path.basename(notice.file) },
      ],
    });
  }

  dismissStorageNotice(id: string): number {
    return this.#hub.updateApp({
      storageNotices: this.#hub.app.storageNotices.filter((notice) => notice.id !== id),
    });
  }
}
