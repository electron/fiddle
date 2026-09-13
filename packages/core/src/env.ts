/**
 * Variables removed from the parent environment by default when
 * {@link ChildEnvOptions} are used. `*` matches any run of characters, and
 * matching ignores case.
 */
export const DEFAULT_ENV_DENYLIST: readonly string[] = Object.freeze([
  '*_TOKEN',
  '*_API_KEY',
  '*_SECRET',
  '*_PASSWORD',
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
]);

/** Variables that never reach a child process, whatever the options say. */
export const ALWAYS_BLOCKED_ENV: readonly string[] = Object.freeze(['LD_*', 'DYLD_*']);

/** Variables never inherited from the parent. They can still be set through `vars`. */
const NEVER_INHERITED_ENV = ['NODE_OPTIONS', 'ELECTRON_RUN_AS_NODE'];

export interface ChildEnvOptions {
  /** Name patterns removed from the parent environment. Default: {@link DEFAULT_ENV_DENYLIST}. */
  denylist?: readonly string[];
  /** More name patterns to remove, on top of `denylist` or the default. */
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
  const denied = [
    ...(opts.denylist ?? DEFAULT_ENV_DENYLIST),
    ...(opts.extraDenylist ?? []),
    ...NEVER_INHERITED_ENV,
  ]
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
