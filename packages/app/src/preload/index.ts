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
