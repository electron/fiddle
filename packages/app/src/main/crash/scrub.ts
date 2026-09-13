/**
 * Redaction shared by the log file and Sentry (REQUIREMENTS §14).
 *
 * - `redactSecrets`: token patterns, and the home directory becomes `~`.
 *   Used for every log entry.
 * - `scrubText`: also strips URL query strings and gist IDs. Used for
 *   everything Sentry sends.
 * - `prepareEvent` (`beforeSend`) and `scrubBreadcrumb` (`beforeBreadcrumb`).
 *   Fiddle contents, console output and the environment never leave: extras,
 *   user data, request bodies, stack-frame variables and unknown contexts are
 *   dropped, and so are console and network breadcrumbs. Native crash dumps
 *   from main (or any other non-renderer process) are never sent; a renderer
 *   dump is sent only if the user agrees to that one crash.
 *
 * No Electron imports.
 */

export const REDACTED = '[redacted]';

/** Keys whose values are secrets (`author` is not). */
const SECRET_KEY = /token|secret|passw(?:or)?d|api[_-]?key|auth(?!or)|cookie|credential/i;

export function isSecretKey(key: string): boolean {
  return SECRET_KEY.test(key);
}

const TOKEN_PATTERNS: readonly [RegExp, string][] = [
  // GitHub: classic, OAuth, user-to-server, server-to-server and refresh tokens; fine-grained PATs.
  [/\bgh[pousr]_[A-Za-z0-9]{36,251}\b/g, REDACTED],
  [/\bgithub_pat_[A-Za-z0-9_]{22,255}\b/g, REDACTED],
  // npm automation and publish tokens.
  [/\bnpm_[A-Za-z0-9]{36}\b/g, REDACTED],
  // Authorization headers.
  [/\b(Bearer|token|Basic)\s+[A-Za-z0-9._~+/-]{16,}=*/g, `$1 ${REDACTED}`],
  // key=value and "key": "value" pairs that name a secret.
  [
    /\b([\w-]*(?:token|secret|passw(?:or)?d|api[_-]?key|auth(?!or))[\w-]*)(["']?\s*[:=]\s*["']?)(?!\[redacted\])[^\s"'&,;#]+/gi,
    `$1$2${REDACTED}`,
  ],
  // user:password@ in URLs.
  [/(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi, `$1${REDACTED}@`],
];

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const homePatterns = new Map<string, RegExp>();

function homePattern(home: string): RegExp | undefined {
  if (home.length < 2) return undefined;
  let pattern = homePatterns.get(home);
  if (!pattern) {
    // The home directory as written, with forward slashes, and with JSON-escaped backslashes.
    const variants = new Set([home, home.replace(/\\/g, '/'), home.replace(/\\/g, '\\\\')]);
    const flags = /^[a-z]:\\/i.test(home) ? 'gi' : 'g';
    pattern = new RegExp(
      [...variants]
        .sort((a, b) => b.length - a.length)
        .map(escapeRegExp)
        .join('|'),
      flags,
    );
    homePatterns.set(home, pattern);
  }
  return pattern;
}

/** Replaces the home directory with `~` and redacts token patterns. */
export function redactSecrets(text: string, home: string): string {
  let out = text;
  const pattern = homePattern(home);
  if (pattern) out = out.replace(pattern, '~');
  for (const [regex, replacement] of TOKEN_PATTERNS) out = out.replace(regex, replacement);
  return out;
}

/** Gist IDs are 20 or 32 hex characters (40-character commit SHAs are left alone). */
const GIST_ID = /\b(?:[0-9a-f]{32}|[0-9a-f]{20})\b/gi;
const URL_QUERY = /(\b[a-z][a-z0-9+.-]*:\/\/[^\s?#"'<>]*)\?[^\s#"'<>]*/gi;

/** `redactSecrets`, plus URL query strings and gist IDs removed. */
export function scrubText(text: string, home: string): string {
  return redactSecrets(text, home).replace(URL_QUERY, '$1').replace(GIST_ID, '<gist-id>');
}

/** Sentry event keys that are identifiers or SDK data, never user content. */
const KEEP_AS_IS = new Set([
  'event_id',
  'timestamp',
  'start_timestamp',
  'release',
  'dist',
  'environment',
  'platform',
  'level',
  'sdk',
  'debug_meta',
  'sdkProcessingMetadata',
  'spans',
]);

/** Event keys that can carry fiddle code, console output or env. */
const DROPPED_KEYS = new Set(['extra', 'user', 'server_name', 'modules']);

/** Contexts that describe the app and the machine. Anything else is dropped. */
const ALLOWED_CONTEXTS = new Set([
  'app',
  'os',
  'device',
  'runtime',
  'electron',
  'chrome',
  'node',
  'gpu',
  'culture',
  'trace',
]);

/** Breadcrumb categories that would carry console output or request URLs. */
const DROPPED_BREADCRUMBS = new Set(['console', 'fetch', 'xhr', 'http', 'electron.net', 'net']);

function scrubValue(value: unknown, home: string, depth = 0): unknown {
  if (typeof value === 'string') return scrubText(value, home);
  if (depth > 20 || typeof value !== 'object' || value === null) return value;
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, home, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === 'vars') continue; // stack-frame local variables
    out[key] = typeof item === 'string' && isSecretKey(key) ? REDACTED : scrubValue(item, home, depth + 1);
  }
  return out;
}

/** `beforeBreadcrumb`: drops console and network breadcrumbs, scrubs the rest. */
export function scrubBreadcrumb<B extends { category?: string }>(crumb: B, home: string): B | null {
  if (crumb.category && DROPPED_BREADCRUMBS.has(crumb.category)) return null;
  return scrubValue(crumb, home) as B;
}

/** Removes what may hold fiddle code, console output or env, and scrubs every string. */
export function scrubEvent<E extends object>(event: E, home: string): E {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event)) {
    if (DROPPED_KEYS.has(key)) continue;
    if (KEEP_AS_IS.has(key)) {
      out[key] = value;
    } else if (key === 'contexts' && value && typeof value === 'object') {
      const contexts: Record<string, unknown> = {};
      for (const [name, context] of Object.entries(value)) {
        if (!ALLOWED_CONTEXTS.has(name)) continue;
        contexts[name] = name === 'trace' ? context : scrubValue(context, home);
      }
      out.contexts = contexts;
    } else if (key === 'request' && value && typeof value === 'object') {
      const { url } = value as { url?: unknown };
      if (typeof url === 'string') out.request = { url: scrubText(url, home) };
    } else if (key === 'breadcrumbs' && Array.isArray(value)) {
      out.breadcrumbs = value
        .map((crumb: { category?: string }) => scrubBreadcrumb(crumb, home))
        .filter((crumb) => crumb !== null);
    } else {
      out[key] = scrubValue(value, home);
    }
  }
  return out as E;
}

/** Native crash events carry these tags (set by Sentry's minidump integration). */
interface CrashTags {
  tags?: { [key: string]: unknown };
}

/**
 * `beforeSend`. A native crash dump from any process but a renderer is
 * dropped; a renderer dump is sent only when `askConsent` resolves true.
 * Everything that is sent is scrubbed.
 */
export async function prepareEvent<E extends CrashTags>(
  event: E,
  home: string,
  askConsent: () => Promise<boolean>,
): Promise<E | null> {
  if (event.tags?.['event.environment'] === 'native') {
    if (event.tags['event.process'] !== 'renderer') return null;
    if (!(await askConsent())) return null;
  }
  return scrubEvent(event, home);
}
