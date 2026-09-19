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
import { tm } from '../i18n';
import type { JsonStore, JsonStoreNotice } from '../persistence/json-store';
import type { AppPatch } from '../state-hub';

export const SETTINGS_VERSION = 1;

export interface SettingsHub {
  readonly app: AppState;
  updateApp(patch: AppPatch): number;
}

function isSettingKey(key: string): key is SettingKey {
  return (settingKeys as string[]).includes(key);
}

function unknownSetting(key: string): FiddleError {
  return new FiddleError(
    ErrorCode.invalidArgument,
    tm('mainSettings')('unknownSetting', { key }),
  );
}

/** Keeps the keys this app version doesn't know, so they round-trip. */
function unknownKeys(sparse: SparseSettings): Record<string, unknown> {
  return Object.fromEntries(Object.entries(sparse).filter(([key]) => !isSettingKey(key)));
}

/** Per-key validation of an outside settings object. Invalid and unknown keys are dropped. */
export function sanitizeSettings(data: Record<string, unknown>): {
  settings: SparseSettings;
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
  return { settings: sparse as SparseSettings, dropped };
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

  set(key: string, value: unknown): number {
    if (!isSettingKey(key)) throw unknownSetting(key);
    const parsed = parseSetting(key, value);
    if (!parsed) {
      throw new FiddleError(
        ErrorCode.invalidArgument,
        tm('mainSettings')('invalidValue', { setting: tm('settings')(`${key}.title`) }),
        { key },
      );
    }
    return this.replace({ ...this.settings, [key]: parsed.value });
  }

  reset(key: string): number {
    if (!isSettingKey(key)) throw unknownSetting(key);
    return this.set(key, defaultSettings[key]);
  }

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
