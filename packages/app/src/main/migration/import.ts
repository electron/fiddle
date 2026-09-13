/**
 * The one-time import from the previous Electron Fiddle (REQUIREMENTS §6).
 *
 * - Runs on the first launch, before any store is created, so it finishes
 *   before any new settings are written. `importedFrom: { version, at }` in
 *   state.json marks it done (`version` is the app version that ran it).
 * - Idempotent: every file is created only if it doesn't exist yet, so a run
 *   that was interrupted can simply run again.
 * - Old files are only read: nothing is ever moved or deleted.
 *
 * What it imports:
 * - localStorage settings (read by ./local-storage.ts) → sparse settings.json,
 *   onboarding.json (`tourDone`). Unknown keys are logged and ignored.
 * - `local-versions.json` (and the older `local-electron-versions` key) →
 *   local-builds.json `{ schemaVersion, builds: [{ id, name, path, addedAt }] }`.
 * - `.github-credentials` → `credentials/github`, re-encrypted with the Gists
 *   slice's CredentialStore.
 * - `~/.electron-fiddle/themes/*.json` → `<userData>/themes/`, keeping the
 *   Monaco editor colours; UI tokens come from Lucent.
 * - `electron-bin/` → the core cache (`importElectronVersions`), which the
 *   caller runs in the background after startup.
 *
 * No Electron imports: Electron APIs are injected, so this runs in plain Node tests.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import { Installer } from '@electron/fiddle-core';
import semver from 'semver';

import { GITHUB_TOKEN_PATTERN } from '../../fiddle/github';
import { BUILTIN_THEME } from '../../shared/settings';
import { CredentialStore, type SafeStorageLike } from '../github/credentials';
import { log } from '../log';
import { themeFromMonaco, themeId, writeTheme } from '../themes/themes';
import { mapOldSettings, oldThemeKey, type OldLocalVersion } from './old-settings';

/** The `schemaVersion` of the files written here (settings, state, onboarding, local builds). */
const SCHEMA_VERSION = 1;

export interface ImportedFrom {
  /** The version of this app that ran the import. */
  version: string;
  /** ISO timestamp. */
  at: string;
}

export interface LocalBuild {
  id: string;
  name: string;
  path: string;
  addedAt: string;
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

function readJsonObject(file: string): Record<string, unknown> | undefined {
  try {
    const data: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    return typeof data === 'object' && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/** Creates `file` with `data`, never overwriting. Returns false when it already exists. */
async function createJsonFile(file: string, data: unknown): Promise<boolean> {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  try {
    await fsp.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, { flag: 'wx' });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw error;
  }
}

/** Replaces `file` atomically: temp file, then rename. */
async function writeJsonAtomic(file: string, data: unknown): Promise<void> {
  const tmp = `${file}.${randomUUID()}.tmp`;
  try {
    await fsp.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`);
    await fsp.rename(tmp, file);
  } catch (error) {
    await fsp.rm(tmp, { force: true });
    throw error;
  }
}

/** Old themes → `<userData>/themes/<id>.json`. Returns old file name (no `.json`) → new ID. */
export async function importThemes(oldDir: string, newDir: string): Promise<Map<string, string>> {
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
      const title = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : key;
      // Keeps only the Monaco editor data; `common` UI tokens now come from Lucent.
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

function readOldLocalVersions(file: string): OldLocalVersion[] {
  const data = readJsonObject(file);
  const list = Array.isArray(data?.versions) ? data.versions : [];
  return list.flatMap((entry: unknown) => {
    const { version, localPath, name } = (entry ?? {}) as Record<string, unknown>;
    return typeof version === 'string' && typeof localPath === 'string'
      ? [{ version, localPath, ...(typeof name === 'string' ? { name } : {}) }]
      : [];
  });
}

/** Old local versions → local builds, one per folder. */
export function toLocalBuilds(versions: readonly OldLocalVersion[], now: Date): LocalBuild[] {
  const byPath = new Map<string, LocalBuild>();
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
async function importGitHubToken(deps: ImportDeps, login: string | undefined): Promise<string> {
  const oldFile = path.join(deps.userData, '.github-credentials');
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
  const store = new CredentialStore({ file: newFile, safeStorage: deps.safeStorage, platform: deps.platform });
  // `login` may be empty: the Gists slice replaces it after its startup check.
  const saved = await store.save({ token, login: login ?? '' }, { allowPlaintext: false });
  return saved ? 'imported' : 'session-only';
}

/** Runs the import unless state.json says it already ran. */
export async function importOldApp(deps: ImportDeps): Promise<ImportResult> {
  const { userData, home } = deps;
  const now = deps.now?.() ?? new Date();
  const stateFile = path.join(userData, 'state.json');
  const state = readJsonObject(stateFile);
  if (state?.importedFrom) return { firstLaunch: false, summary: {} };

  const summary: Record<string, unknown> = {};

  let values: Record<string, string> = {};
  try {
    values = (await deps.readLocalStorage()) ?? {};
  } catch (error) {
    log.warn('import: could not read the old localStorage', error);
  }

  const themeIds = await importThemes(
    path.join(home, '.electron-fiddle', 'themes'),
    path.join(userData, 'themes'),
  );
  summary.themes = themeIds.size;

  const mapped = mapOldSettings(values, { themeIds, osUser: deps.osUser });
  if (mapped.unknown.length) log.warn('import: ignoring unknown localStorage keys', mapped.unknown);
  if (mapped.invalid.length) log.warn('import: ignoring invalid old values', mapped.invalid);

  const settingKeys = Object.keys(mapped.settings);
  if (settingKeys.length) {
    const created = await createJsonFile(path.join(userData, 'settings.json'), {
      schemaVersion: SCHEMA_VERSION,
      ...mapped.settings,
    });
    summary.settings = created ? settingKeys : 'kept';
  }

  if (mapped.tourDone) {
    await createJsonFile(path.join(userData, 'onboarding.json'), {
      schemaVersion: SCHEMA_VERSION,
      tourDone: true,
    });
  }

  const builds = toLocalBuilds(
    [...readOldLocalVersions(path.join(userData, 'local-versions.json')), ...mapped.localVersions],
    now,
  );
  if (builds.length) {
    const created = await createJsonFile(path.join(userData, 'local-builds.json'), {
      schemaVersion: SCHEMA_VERSION,
      builds,
    });
    summary.localBuilds = created ? builds.length : 'kept';
  }

  // Not named after the token: the log would redact a key like that.
  summary.github = await importGitHubToken(deps, mapped.gitHubLogin);

  const importedFrom: ImportedFrom = { version: deps.version, at: now.toISOString() };
  await fsp.mkdir(userData, { recursive: true });
  await writeJsonAtomic(stateFile, { schemaVersion: SCHEMA_VERSION, ...state, importedFrom });
  return { firstLaunch: true, summary };
}

/** Electron's `fs` treats .asar files as folders; copying an Electron build must not. */
async function withNoAsar<T>(fn: () => Promise<T>): Promise<T> {
  const proc = process as { noAsar?: boolean };
  const previous = proc.noAsar;
  proc.noAsar = true;
  try {
    return await fn();
  } finally {
    proc.noAsar = previous;
  }
}

/** Copies a folder into place through a temp folder, so the target is complete or absent. */
async function copyIntoPlace(source: string, target: string): Promise<void> {
  await fsp.mkdir(path.dirname(target), { recursive: true });
  const tmp = await fsp.mkdtemp(path.join(path.dirname(target), `.tmp-${path.basename(target)}-`));
  try {
    await withNoAsar(() => fsp.cp(source, tmp, { recursive: true, verbatimSymlinks: true }));
    await fsp.rename(tmp, target);
  } catch (error) {
    await withNoAsar(() => fsp.rm(tmp, { recursive: true, force: true }));
    throw error;
  }
}

/**
 * Old `<userData>/electron-bin` → `<cache>/electron/<version>`, the per-version
 * layout core uses. Extracted folders (`current/`, `<version>/`) are copied;
 * zips for this platform are extracted by core's Installer. Versions already
 * in the cache are skipped. Returns the versions that were imported.
 */
export async function importElectronVersions(
  oldBin: string,
  versionsDir: string,
  { platform = process.platform, arch = process.arch } = {},
): Promise<string[]> {
  let names: string[];
  try {
    names = await fsp.readdir(oldBin);
  } catch {
    return [];
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
    const version = (await fsp.readFile(path.join(dir, 'version'), 'utf8').catch(() => ''))
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
    { layout: 'per-version', locks: true },
  );
  const imported: string[] = [];
  for (const version of new Set([...folders.keys(), ...zips])) {
    if (fs.existsSync(path.join(versionsDir, version))) continue;
    try {
      const folder = folders.get(version);
      if (folder) await copyIntoPlace(folder, path.join(versionsDir, version));
      else await installer.install(version);
      imported.push(version);
    } catch (error) {
      log.warn('import: could not import Electron', version, error);
    }
  }
  return imported;
}
