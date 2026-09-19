/** The Content-Security-Policy sent with every app:// response. */
import { session } from 'electron';

/** Trusted Types policy names the app may create. Add a name here before code calls `trustedTypes.createPolicy`. */
const trustedTypesPolicies: readonly string[] = [
  // Monaco's own policies.
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
  // Creates Monaco's workers from bundled URLs.
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
  'trusted-types': [...trustedTypesPolicies, "'allow-duplicates'"],
};

function serialize(directives: Directives): string {
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
}

export const PRODUCTION_CSP = serialize(production);

/** The Vite dev server: `script-src` allows the inline React Refresh preamble, and `connect-src` its hot-reload websocket. */
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
