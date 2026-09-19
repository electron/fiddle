/**
 * Windows run with `sandbox: true`, so this is bundled into one CommonJS file.
 * It exposes only the EIPC bindings, whose generated code checks the origin and
 * frame. `ipcRenderer` itself is never exposed.
 */
import '../ipc/generated/preload/fiddle';

// Sentry's renderer transport (IPCMode.Classic): the one exception to EIPC. It
// follows the same origin rule, and the renderer uses it only when Sentry is on.
import { hookupIpc } from '@sentry/electron/preload-namespaced';

const { protocol, host, hostname } = window.location;
// The Vite dev server origin exists only in `yarn start`; other builds compile that branch out.
const devServer =
  import.meta.env.MODE === 'development' &&
  protocol === 'http:' &&
  hostname === 'localhost';
if ((protocol === 'app:' && host === 'main') || devServer) {
  hookupIpc();
}
