/** The Content-Security-Policy, sent as a response header on every app:// response (see protocol.ts). */
import { session } from 'electron';

/**
 * Trusted Types policy names the app may create. Add a name here when code
 * (Monaco, for example) calls `trustedTypes.createPolicy`; an empty list
 * allows none.
 */
const trustedTypesPolicies: readonly string[] = [
  // Monaco (monaco-editor 0.56, `createTrustedTypesPolicy` calls in its ESM build).
  'defaultWorkerFactory',
  'diffEditorWidget',
  'diffReview',
  'domLineBreaksComputer',
  'editorGhostText',
  'editorViewLayer',
  'richScreenReaderContent',
  'standaloneColorizer',
  'stickyScrollViewLayer',
  'tokenizeToString',
  // src/renderer/editor/monaco.ts: creates Monaco's workers from bundled URLs.
  'fiddleMonacoWorker',
];

type Directives = Record<string, string[]>;

const production: Directives = {
  'default-src': ["'none'"],
  'script-src': ["'self'"],
  'worker-src': ["'self'"],
  // Monaco needs inline styles.
  'style-src': ["'self'", "'unsafe-inline'"],
  'font-src': ["'self'"],
  'img-src': ["'self'", 'data:'],
  'connect-src': ["'self'"],
  'frame-src': ["'none'"],
  'object-src': ["'none'"],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
  'frame-ancestors': ["'none'"],
  'require-trusted-types-for': ["'script'"],
  // Monaco's bundle creates `defaultWorkerFactory` from two modules, hence 'allow-duplicates'.
  'trusted-types': trustedTypesPolicies.length
    ? [...trustedTypesPolicies, "'allow-duplicates'"]
    : ["'none'"],
};

function serialize(directives: Directives): string {
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
}

export const PRODUCTION_CSP = serialize(production);

/**
 * Dev differences (unpackaged app on the Vite dev server only):
 * - `script-src` adds 'unsafe-inline': @vitejs/plugin-react injects its React
 *   Refresh preamble as an inline module script.
 * - `connect-src` adds the dev server's ws:// origin for hot module reload.
 */
function devCsp(devServerUrl: string): string {
  const { host } = new URL(devServerUrl);
  return serialize({
    ...production,
    'script-src': ["'self'", "'unsafe-inline'"],
    'connect-src': ["'self'", `ws://${host}`],
  });
}

/** Adds the dev CSP to responses from the Vite dev server, which sends none. */
export function installDevCsp(devServerUrl: string): void {
  const policy = devCsp(devServerUrl);
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: [`${new URL(devServerUrl).origin}/*`] },
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [policy],
        },
      });
    },
  );
}
