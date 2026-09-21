/**
 * Runs before any store exists, so it writes the new files itself. Every file
 * is created only if it doesn't exist yet, and old files are only read.
 * Electron APIs are injected, so this runs in plain Node tests.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import {
  copyFolder,
  Installer,
  removeBestEffort,
  renameWithRetry,
} from '@electron/fiddle-core';
import semver from 'semver';

import { GITHUB_TOKEN_PATTERN } from '../../fiddle/github';
import { BUILTIN_THEME } from '../../shared/settings';
import {
  CredentialStore,
  legacyTokenFile,
  type SafeStorageLike,
} from '../github/credentials';
import { log } from '../log';
import { readJsonObjectSync, writeAtomic } from '../persistence/json-store';
import { SETTINGS_VERSION } from '../settings/service';
import type { StoredBuild } from '../versions/service';
import { themeFromMonaco, themeId, writeTheme } from '../themes/themes';
import {
  mapOldSettings,
  oldThemeKey,
  parseOldLocalVersions,
  type OldLocalVersion,
} from './old-settings';

// The `version` of the stores that own these files (documents/service.ts, versions/service.ts).
const STATE_VERSION = 1;
const LOCAL_BUILDS_VERSION = 1;

/** Launches that try the old localStorage before the import goes on without it. */
const MAX_STORAGE_TRIES = 3;

interface ImportedFrom {
  /** The version of this app that ran the import. */
  version: string;
  /** ISO timestamp. */
  at: string;
  /** Set when the old settings could not be read and were not imported. */
  localStorage?: 'unreadable';
}

export interface ImportDeps {
  userData: string;
  home: string;
  /** This app's version, recorded in `importedFrom`. */
  version: string;
  /** The OS user name; an old package author equal to it stays unset. */
  osUser: string;
  platform: NodeJS.Platform;
  /** Reads the old app's file:// localStorage. Undefined when there is none. */
  readLocalStorage(): Promise<Record<string, string> | undefined>;
  /** The old app encrypted with sync `encryptString`; the new file uses the async API. */
  safeStorage: SafeStorageLike & { decryptString(encrypted: Buffer): string };
  now?: () => Date;
}

export interface ImportResult {
  /** False when an earlier launch already ran the import. */
  firstLaunch: boolean;
  /** What was imported, for the log. */
  summary: Record<string, unknown>;
}

/** state.json's object; undefined when there is no file. Throws when it exists but can't be read as an object. */
function readStateFile(file: string): Record<string, unknown> | undefined {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
  const data: unknown = JSON.parse(text);
  if (typeof data !== 'object' || data === null || Array.isArray(data))
    throw new Error(`${file} is not an object`);
  return data as Record<string, unknown>;
}

/** Creates `file` with `data`, never overwriting. Returns false when it already exists. */
async function createJsonFile(file: string, data: unknown): Promise<boolean> {
  if (fs.existsSync(file)) return false;
  await writeAtomic(file, `${JSON.stringify(data, null, 2)}\n`);
  return true;
}

/** Old themes → `<userData>/themes/<id>.json`. Returns old file name (no `.json`) → new ID. */
async function importThemes(
  oldDir: string,
  newDir: string,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  let names: string[];
  try {
    names = await fsp.readdir(oldDir);
  } catch {
    return ids;
  }
  for (const name of names.sort()) {
    if (!name.toLowerCase().endsWith('.json')) continue;
    const key = oldThemeKey(name);
    try {
      const data = JSON.parse(await fsp.readFile(path.join(oldDir, name), 'utf8')) as {
        name?: unknown;
        isDark?: unknown;
        editor?: unknown;
      };
      const title =
        typeof data.name === 'string' && data.name.trim() ? data.name.trim() : key;
      // Keeps only the Monaco editor data; `common` UI tokens come from Lucent.
      const theme = themeFromMonaco(title, data.editor);
      if (typeof data.isDark === 'boolean') theme.isDark = data.isDark;
      // The ID comes from the old file name, so a second run finds the same file.
      const id = themeId(key, new Set([BUILTIN_THEME]));
      try {
        await writeTheme(newDir, id, theme);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      }
      ids.set(key, id);
    } catch (error) {
      log.warn('import: skipping an old theme', name, error);
    }
  }
  return ids;
}

/** Old local versions → local builds, one per folder. */
function toLocalBuilds(versions: readonly OldLocalVersion[], now: Date): StoredBuild[] {
  const byPath = new Map<string, StoredBuild>();
  for (const { version, localPath, name } of versions) {
    if (byPath.has(localPath)) continue;
    // The old app named local versions `0.0.0-local.<Date.now()>`.
    const stamp = /-local\.(\d{10,})$/.exec(version)?.[1];
    const added = stamp ? new Date(Number(stamp)) : now;
    byPath.set(localPath, {
      id: randomUUID(),
      name: name?.trim() || path.basename(localPath),
      path: localPath,
      addedAt: (Number.isNaN(added.getTime()) ? now : added).toISOString(),
    });
  }
  return [...byPath.values()];
}

/** `.github-credentials` → `credentials/github`. The old file stays where it is. */
async function importGitHubToken(
  deps: ImportDeps,
  login: string | undefined,
): Promise<string> {
  const oldFile = legacyTokenFile(deps.userData);
  const newFile = path.join(deps.userData, 'credentials', 'github');
  if (!fs.existsSync(oldFile)) return 'none';
  if (fs.existsSync(newFile)) return 'kept';
  let token: string;
  try {
    token = deps.safeStorage.decryptString(await fsp.readFile(oldFile));
  } catch (error) {
    log.warn('import: the old GitHub token could not be decrypted', error);
    return 'undecryptable';
  }
  if (!GITHUB_TOKEN_PATTERN.test(token)) return 'invalid';
  const store = new CredentialStore({
    file: newFile,
    safeStorage: deps.safeStorage,
    platform: deps.platform,
  });
  // `login` may be empty: the GitHub service replaces it after its startup check.
  const saved = await store.save(
    { token, login: login ?? '' },
    { allowPlaintext: false },
  );
  return saved ? 'imported' : 'session-only';
}

/** Runs the import unless state.json says it already ran. */
export async function importOldApp(deps: ImportDeps): Promise<ImportResult> {
  const { userData, home } = deps;
  const now = deps.now?.() ?? new Date();
  const stateFile = path.join(userData, 'state.json');
  // An unreadable state.json throws: nothing is written over it, and the JSON store deals with the file.
  const state = readStateFile(stateFile);
  if (state?.importedFrom) return { firstLaunch: false, summary: {} };

  const summary: Record<string, unknown> = {};

  const writeState = (next: Record<string, unknown>) =>
    writeAtomic(
      stateFile,
      `${JSON.stringify({ schemaVersion: STATE_VERSION, ...next }, null, 2)}\n`,
    );

  let values: Record<string, string> = {};
  let storageUnreadable = false;
  try {
    values = (await deps.readLocalStorage()) ?? {};
  } catch (error) {
    // The next launches try again, a few times: a reader window that never answers costs seconds every time.
    const tries = (typeof state?.storageTries === 'number' ? state.storageTries : 0) + 1;
    if (tries < MAX_STORAGE_TRIES) {
      await writeState({ ...state, storageTries: tries });
      throw error;
    }
    log.error(
      'import: the old localStorage could not be read, going on without it',
      error,
    );
    storageUnreadable = true;
    summary.localStorage = 'unreadable';
  }

  const themeIds = await importThemes(
    path.join(home, '.electron-fiddle', 'themes'),
    path.join(userData, 'themes'),
  );
  summary.themes = themeIds.size;

  const mapped = mapOldSettings(values, { themeIds, osUser: deps.osUser });
  if (mapped.unknown.length)
    log.warn('import: ignoring unknown localStorage keys', mapped.unknown);
  if (mapped.invalid.length)
    log.warn('import: ignoring invalid old values', mapped.invalid);

  const settingKeys = Object.keys(mapped.settings);
  if (settingKeys.length) {
    const created = await createJsonFile(path.join(userData, 'settings.json'), {
      schemaVersion: SETTINGS_VERSION,
      ...mapped.settings,
    });
    summary.settings = created ? settingKeys : 'kept';
  }

  const builds = toLocalBuilds(
    [
      ...parseOldLocalVersions(
        readJsonObjectSync(path.join(userData, 'local-versions.json'))?.versions,
      ),
      ...mapped.localVersions,
    ],
    now,
  );
  if (builds.length) {
    const created = await createJsonFile(path.join(userData, 'local-builds.json'), {
      schemaVersion: LOCAL_BUILDS_VERSION,
      builds,
    });
    summary.localBuilds = created ? builds.length : 'kept';
  }

  // Not named after the token: the log would redact a key like that.
  summary.github = await importGitHubToken(deps, mapped.gitHubLogin);

  const importedFrom: ImportedFrom = {
    version: deps.version,
    at: now.toISOString(),
    ...(storageUnreadable ? { localStorage: 'unreadable' as const } : {}),
  };
  const { storageTries: _tries, ...kept } = state ?? {};
  // Onboarding lives in state.json too.
  const onboarding = mapped.tourDone ? { tourDone: true } : {};
  await writeState({ ...kept, ...onboarding, importedFrom });
  return { firstLaunch: true, summary };
}

/** Not `.tmp-`: core's Installer keeps its in-flight folders under that prefix in the same cache. */
const IMPORT_TMP_PREFIX = '.import-';

/** Copies a folder into place through a temp folder, so the target is complete or absent. */
async function copyIntoPlace(source: string, target: string): Promise<void> {
  await fsp.mkdir(path.dirname(target), { recursive: true });
  const tmp = await fsp.mkdtemp(
    path.join(path.dirname(target), `${IMPORT_TMP_PREFIX}${path.basename(target)}-`),
  );
  try {
    await copyFolder(source, tmp, { verbatimSymlinks: true });
    await renameWithRetry(tmp, target);
  } catch (error) {
    await removeBestEffort(tmp);
    throw error;
  }
}

/**
 * Old `<userData>/electron-bin` → `<cache>/electron/<version>`, the per-version
 * layout core uses. Extracted folders are copied, zips for this platform are
 * extracted. Versions already in the cache are skipped. Returns the versions
 * that were imported, and throws once every version was tried if any failed.
 */
export async function importElectronVersions(
  oldBin: string,
  versionsDir: string,
  { platform = process.platform, arch = process.arch } = {},
): Promise<string[]> {
  let names: string[];
  try {
    names = await fsp.readdir(oldBin);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const zip = new RegExp(`^electron-v(.+)-${platform}-${arch}\\.zip$`);
  const folders = new Map<string, string>();
  const zips = new Set<string>();
  for (const name of names) {
    const zipVersion = zip.exec(name)?.[1];
    if (zipVersion && semver.valid(zipVersion)) {
      zips.add(zipVersion);
      continue;
    }
    const dir = path.join(oldBin, name);
    const version = (
      await fsp.readFile(path.join(dir, 'version'), 'utf8').catch(() => '')
    )
      .trim()
      .replace(/^v/, '');
    if (semver.valid(version) && !folders.has(version)) folders.set(version, dir);
  }

  const installer = new Installer(
    {
      electronDownloads: oldBin,
      electronInstall: path.join(oldBin, 'current'),
      electronVersions: versionsDir,
    },
    { layout: 'per-version' },
  );
  // A copy cut short by a quit leaves its temp folder behind.
  for (const name of await fsp.readdir(versionsDir).catch(() => [] as string[])) {
    if (name.startsWith(IMPORT_TMP_PREFIX))
      await removeBestEffort(path.join(versionsDir, name));
  }
  const imported: string[] = [];
  const failed: string[] = [];
  for (const version of new Set([...folders.keys(), ...zips])) {
    if (fs.existsSync(path.join(versionsDir, version))) continue;
    try {
      const folder = folders.get(version);
      if (folder) await copyIntoPlace(folder, path.join(versionsDir, version));
      else await installer.install(version);
      imported.push(version);
    } catch (error) {
      log.warn('import: could not import Electron', version, error);
      failed.push(version);
    }
  }
  if (failed.length) throw new Error(`could not import Electron ${failed.join(', ')}`);
  return imported;
}
