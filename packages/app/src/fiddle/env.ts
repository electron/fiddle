/** Set when "Advanced Electron logging" is on. */
export const ADVANCED_LOGGING_ENV: Readonly<Record<string, string>> = {
  ELECTRON_ENABLE_LOGGING: 'true',
  ELECTRON_DEBUG_NOTIFICATIONS: 'true',
  ELECTRON_ENABLE_STACK_DUMPING: 'true',
};

/**
 * Parent-environment variables no child process gets: secrets, the app's own
 * (`ELECTRON_FIDDLE_*`, the e2e driver's included), and the ones users can't
 * set either (see {@link isBlockedUserEnvKey}). `*` matches any run of
 * characters, and case is ignored.
 */
const PARENT_ENV_DENYLIST = [
  '*_TOKEN',
  '*_API_KEY',
  '*_SECRET',
  '*_SECRET_KEY',
  '*_PRIVATE_KEY',
  '*_ACCESS_KEY',
  '*_PASSWORD',
  '*_PASSPHRASE',
  '*_CREDENTIALS',
  'DATABASE_URL',
  'NPM_CONFIG_*_AUTH',
  'NPM_CONFIG_*_AUTHTOKEN',
  'AWS_*',
  'SSH_AUTH_SOCK',
  'SENTRY_*',
  'ELECTRON_FIDDLE_*',
  'NODE_OPTIONS',
  'ELECTRON_RUN_AS_NODE',
  'LD_*',
  'DYLD_*',
].map((pattern) => new RegExp(`^${pattern.replaceAll('*', '.*')}$`, 'i'));

export interface ParsedEnvEntries {
  env: Record<string, string>;
  /** Entries that couldn't be parsed as `KEY=value`. */
  invalid: string[];
  /** Keys refused because they're blocked (see {@link isBlockedUserEnvKey}). */
  blocked: string[];
}

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

const BLOCKED_USER_ENV_KEYS: readonly string[] = ['NODE_OPTIONS', 'ELECTRON_RUN_AS_NODE'];

/**
 * Variables the user can't set, ignoring case, because they change what
 * Electron runs: `LD_*` and `DYLD_*` load code through the dynamic loader,
 * `NODE_OPTIONS` can `--require` any file, and `ELECTRON_RUN_AS_NODE` turns
 * Electron into plain Node.js.
 */
export function isBlockedUserEnvKey(key: string): boolean {
  const upper = key.toUpperCase();
  return (
    upper.startsWith('LD_') ||
    upper.startsWith('DYLD_') ||
    BLOCKED_USER_ENV_KEYS.includes(upper)
  );
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
  if (
    value.length >= 2 &&
    (value[0] === '"' || value[0] === "'") &&
    value.at(-1) === value[0]
  ) {
    value = value.slice(1, -1);
  }
  return [key, value];
}

/**
 * Parses the user's `KEY=value` list. Empty entries are dropped; entries that
 * don't parse are reported in `invalid`, blocked keys in `blocked`. Later
 * entries win (ignoring case on Windows).
 */
export function parseEnvEntries(
  entries: readonly string[],
  platform: NodeJS.Platform = process.platform,
): ParsedEnvEntries {
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
  /** Already-parsed user variables. Blocked keys are dropped. */
  userEnv?: Readonly<Record<string, string>>;
  advancedLogging?: boolean;
}

/** `parent` minus {@link PARENT_ENV_DENYLIST}, then `vars` minus the blocked keys. On Windows a variable replaces any differently-cased copy. */
function childEnv(
  vars: Iterable<readonly [string, string | undefined]>,
  parent: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  return envFromEntries([
    ...Object.entries(parent).filter(
      ([name]) => !PARENT_ENV_DENYLIST.some((re) => re.test(name)),
    ),
    ...[...vars].filter(([name]) => !isBlockedUserEnvKey(name)),
  ]);
}

/** The environment for fiddle processes: the filtered parent's, then the advanced-logging variables, then the user's. */
export function fiddleProcessEnv(
  options: FiddleEnvOptions = {},
  parent: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  return childEnv(
    [
      ...Object.entries(options.advancedLogging ? ADVANCED_LOGGING_ENV : {}),
      ...Object.entries(options.userEnv ?? {}),
    ],
    parent,
  );
}

/** Where `.npmrc` and Yarn read registry credentials from. */
const PACKAGE_MANAGER_AUTH_ENV =
  /^(?:NPM_TOKEN|NODE_AUTH_TOKEN|YARN_NPM_AUTH_TOKEN|YARN_NPM_AUTH_IDENT|NPM_CONFIG_.*_AUTH(?:TOKEN)?)$/i;

/**
 * The environment for npm, yarn and Forge: the fiddle's, plus the registry
 * credentials above, so an install doesn't fail on `${NPM_TOKEN}` in
 * `~/.npmrc`. Other secrets stay out, since install scripts run with it.
 */
export function packageManagerEnv(
  parent: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  return childEnv(
    Object.entries(parent).filter(([name]) => PACKAGE_MANAGER_AUTH_ENV.test(name)),
    parent,
  );
}
