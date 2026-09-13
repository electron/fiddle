/** Set when "Advanced Electron logging" is on. */
export const ADVANCED_LOGGING_ENV: Readonly<Record<string, string>> = {
  ELECTRON_ENABLE_LOGGING: 'true',
  ELECTRON_DEBUG_NOTIFICATIONS: 'true',
  ELECTRON_ENABLE_STACK_DUMPING: 'true',
};

/** Parent-environment variables never passed to fiddle processes (§4). */
export const DENIED_ENV_KEYS = ['GITHUB_TOKEN', 'GH_TOKEN', 'NPM_TOKEN', 'NODE_AUTH_TOKEN'] as const;
export const DENIED_ENV_SUFFIXES = ['_TOKEN', '_API_KEY'] as const;
/** `ELECTRON_FIDDLE_` covers app-internal variables, including the e2e driver's. */
export const DENIED_ENV_PREFIXES = ['SENTRY_', 'ELECTRON_FIDDLE_'] as const;

export interface EnvDenylist {
  keys?: readonly string[];
  prefixes?: readonly string[];
  suffixes?: readonly string[];
}

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

/** True if `key` from the parent environment must not reach a fiddle process. */
export function isDeniedParentEnvKey(key: string, extra: EnvDenylist = {}): boolean {
  const upper = key.toUpperCase();
  const keys = [...DENIED_ENV_KEYS, ...(extra.keys ?? [])];
  const prefixes = [...DENIED_ENV_PREFIXES, ...(extra.prefixes ?? [])];
  const suffixes = [...DENIED_ENV_SUFFIXES, ...(extra.suffixes ?? [])];
  return (
    keys.some((k) => k.toUpperCase() === upper) ||
    prefixes.some((p) => upper.startsWith(p.toUpperCase())) ||
    suffixes.some((s) => upper.endsWith(s.toUpperCase()))
  );
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
 * entries win.
 */
export function parseEnvEntries(entries: readonly string[]): ParsedEnvEntries {
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
  return { env: Object.fromEntries(pairs), invalid, blocked };
}

/** Drops empty and whitespace-only entries (extra Electron flags). */
export function cleanFlags(flags: readonly string[]): string[] {
  return flags.map((f) => f.trim()).filter((f) => f !== '' && !f.includes('\0'));
}

export interface FiddleEnvOptions {
  parentEnv: Readonly<Record<string, string | undefined>>;
  /** Already-parsed user variables; blocked keys are dropped again here. */
  userEnv?: Readonly<Record<string, string>>;
  advancedLogging?: boolean;
  denylist?: EnvDenylist;
}

/**
 * The environment for a fiddle process: the parent minus the denylist, then
 * the advanced-logging variables (or their removal), then the user's variables.
 */
export function buildFiddleEnv(options: FiddleEnvOptions): Record<string, string> {
  const env: [string, string][] = Object.entries(options.parentEnv).filter(
    (e): e is [string, string] =>
      typeof e[1] === 'string' &&
      !isDeniedParentEnvKey(e[0], options.denylist) &&
      !Object.hasOwn(ADVANCED_LOGGING_ENV, e[0]),
  );
  if (options.advancedLogging) env.push(...Object.entries(ADVANCED_LOGGING_ENV));
  for (const [key, value] of Object.entries(options.userEnv ?? {})) {
    if (!isBlockedUserEnvKey(key)) env.push([key, value]);
  }
  return Object.fromEntries(env);
}
