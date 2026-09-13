import { buildChildEnv } from '@electron/fiddle-core';

/** Set when "Advanced Electron logging" is on. */
export const ADVANCED_LOGGING_ENV: Readonly<Record<string, string>> = {
  ELECTRON_ENABLE_LOGGING: 'true',
  ELECTRON_DEBUG_NOTIFICATIONS: 'true',
  ELECTRON_ENABLE_STACK_DUMPING: 'true',
};

/**
 * Parent-environment variables kept from fiddle processes on top of core's
 * default denylist (§4): app-internal variables, the e2e driver's included.
 */
export const FIDDLE_EXTRA_ENV_DENYLIST: readonly string[] = ['ELECTRON_FIDDLE_*'];

export interface ParsedEnvEntries {
  env: Record<string, string>;
  /** Entries that couldn't be parsed as `KEY=value`. */
  invalid: string[];
  /** Keys refused because they're blocked (`LD_PRELOAD`, `DYLD_*`). */
  blocked: string[];
}

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** `LD_PRELOAD` and `DYLD_*` can't be set by the user. */
export function isBlockedUserEnvKey(key: string): boolean {
  const upper = key.toUpperCase();
  return upper === 'LD_PRELOAD' || upper.startsWith('DYLD_');
}

/**
 * Builds an environment from `[name, value]` pairs. Later pairs win and
 * undefined values are skipped. On Windows, names that differ only in case
 * are one variable, so the later pair replaces the earlier.
 */
export function envFromEntries(
  entries: Iterable<readonly [string, string | undefined]>,
  platform: NodeJS.Platform = process.platform,
): Record<string, string> {
  const byName = new Map<string, [string, string]>();
  for (const [name, value] of entries) {
    if (value === undefined) continue;
    const key = platform === 'win32' ? name.toUpperCase() : name;
    byName.delete(key);
    byName.set(key, [name, value]);
  }
  return Object.fromEntries(byName.values());
}

/** Parses one `KEY=value` entry. Matching surrounding quotes on the value are removed. */
export function parseEnvEntry(entry: string): [string, string] | null {
  const trimmed = entry.trim();
  const eq = trimmed.indexOf('=');
  if (eq <= 0) return null;
  const key = trimmed.slice(0, eq).trim();
  if (!KEY_RE.test(key)) return null;
  let value = trimmed.slice(eq + 1).trim();
  if (value.includes('\0')) return null;
  if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.at(-1) === value[0]) {
    value = value.slice(1, -1);
  }
  return [key, value];
}

/**
 * Parses the user's `KEY=value` list. Empty entries are dropped; entries that
 * don't parse are reported in `invalid`, blocked keys in `blocked`. Later
 * entries win (ignoring case on Windows).
 */
export function parseEnvEntries(entries: readonly string[], platform: NodeJS.Platform = process.platform): ParsedEnvEntries {
  const pairs: [string, string][] = [];
  const invalid: string[] = [];
  const blocked: string[] = [];
  for (const entry of entries) {
    if (entry.trim() === '') continue;
    const parsed = parseEnvEntry(entry);
    if (!parsed) invalid.push(entry);
    else if (isBlockedUserEnvKey(parsed[0])) blocked.push(parsed[0]);
    else pairs.push(parsed);
  }
  return { env: envFromEntries(pairs, platform), invalid, blocked };
}

/** Drops empty and whitespace-only entries (extra Electron flags). */
export function cleanFlags(flags: readonly string[]): string[] {
  return flags.map((f) => f.trim()).filter((f) => f !== '' && !f.includes('\0'));
}

export interface FiddleEnvOptions {
  /** Already-parsed user variables. `LD_PRELOAD` and `DYLD_*` are dropped. */
  userEnv?: Readonly<Record<string, string>>;
  advancedLogging?: boolean;
}

/**
 * The environment for fiddle processes and module installs, through core's
 * `buildChildEnv`: `parent` minus core's denylist and
 * {@link FIDDLE_EXTRA_ENV_DENYLIST}, then the advanced-logging variables,
 * then the user's. On Windows a variable replaces any differently-cased copy.
 */
export function fiddleProcessEnv(options: FiddleEnvOptions = {}, parent: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const vars = envFromEntries([
    ...Object.entries(options.advancedLogging ? ADVANCED_LOGGING_ENV : {}),
    ...Object.entries(options.userEnv ?? {}),
  ]);
  return buildChildEnv({ extraDenylist: FIDDLE_EXTRA_ENV_DENYLIST, vars }, parent);
}
