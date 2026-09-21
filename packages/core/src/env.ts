/**
 * Variables removed from the parent environment. `*` matches any run of
 * characters, and matching ignores case.
 */
const ENV_DENYLIST: readonly string[] = [
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
  'GITHUB_TOKEN',
  'GH_TOKEN',
  'NPM_TOKEN',
  'NODE_AUTH_TOKEN',
  'NPM_CONFIG_*_AUTH',
  'NPM_CONFIG_*_AUTHTOKEN',
  'AWS_*',
  'CSC_KEY_PASSWORD',
  'SSH_AUTH_SOCK',
  'SENTRY_*',
];

/** Variables that never reach a child process, whatever the options say. */
const ALWAYS_BLOCKED_ENV: readonly string[] = ['LD_*', 'DYLD_*'];

/** Variables never inherited from the parent. They can still be set through `vars`. */
const NEVER_INHERITED_ENV = ['NODE_OPTIONS', 'ELECTRON_RUN_AS_NODE'];

export interface ChildEnvOptions {
  /** More name patterns to remove, on top of the default denylist. */
  extraDenylist?: readonly string[];
  /** Variables added after filtering. `LD_*` and `DYLD_*` are ignored. */
  vars?: Readonly<Record<string, string | undefined>>;
}

function toRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
}

/**
 * Builds a child process environment: `parent` minus the denylist, plus
 * `vars`. `LD_*` and `DYLD_*` are always removed, and `NODE_OPTIONS` and
 * `ELECTRON_RUN_AS_NODE` are never inherited from `parent`.
 */
export function buildChildEnv(
  opts: ChildEnvOptions = {},
  parent: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const blocked = ALWAYS_BLOCKED_ENV.map(toRegExp);
  const denied = [...ENV_DENYLIST, ...(opts.extraDenylist ?? []), ...NEVER_INHERITED_ENV]
    .map(toRegExp)
    .concat(blocked);
  const isDenied = (name: string) => denied.some((re) => re.test(name));
  const isBlocked = (name: string) => blocked.some((re) => re.test(name));

  const env: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(parent)) {
    if (value !== undefined && !isDenied(name)) env[name] = value;
  }
  for (const [name, value] of Object.entries(opts.vars ?? {})) {
    if (value === undefined || isBlocked(name)) continue;
    if (process.platform === 'win32') {
      // Windows variable names ignore case, so drop any differently-cased copy.
      for (const key of Object.keys(env)) {
        if (key.toUpperCase() === name.toUpperCase()) delete env[key];
      }
    }
    env[name] = value;
  }
  return env;
}
