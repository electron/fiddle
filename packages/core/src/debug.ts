import { format } from 'node:util';

/**
 * A tiny stand-in for the `debug` package. Namespaces are enabled through the
 * `DEBUG` environment variable, e.g. `DEBUG=fiddle-core:*`.
 */
export type Debugger = (...args: unknown[]) => void;

function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function isEnabled(namespace: string): boolean {
  const patterns = (process.env.DEBUG ?? '').split(/[\s,]+/).filter(Boolean);
  let enabled = false;
  for (const pattern of patterns) {
    if (pattern.startsWith('-')) {
      if (patternToRegExp(pattern.slice(1)).test(namespace)) return false;
    } else if (patternToRegExp(pattern).test(namespace)) {
      enabled = true;
    }
  }
  return enabled;
}

export function debug(namespace: string): Debugger {
  return (...args: unknown[]) => {
    if (isEnabled(namespace)) process.stderr.write(`${namespace} ${format(...args)}\n`);
  };
}
