/**
 * The preload for every app window. Windows run with `sandbox: true`, so this
 * is bundled into one CommonJS file (vite.preload.config.ts).
 *
 * It exposes only the EIPC bindings, and only to the app's own main frame: the
 * generated preload checks `location.origin` (app://main, or the Vite dev
 * server's http://localhost) and the frame before exposing each interface.
 * `ipcRenderer` itself is never exposed.
 */
import '../ipc/generated/preload/fiddle';

// Sentry's renderer transport (IPCMode.Classic), the one documented exception
// to EIPC (REQUIREMENTS §3, §14). Same origin rule as the EIPC bindings. The
// renderer only uses it when main's Sentry is on (src/main/crash/sentry.ts).
import { hookupIpc } from '@sentry/electron/preload-namespaced';

const { protocol, host, hostname } = window.location;
if ((protocol === 'app:' && host === 'main') || (protocol === 'http:' && hostname === 'localhost')) {
  hookupIpc();
}
