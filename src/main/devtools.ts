import { isDevMode } from '../utils/devmode';

/**
 * Installs developer tools if we're in dev mode.
 *
 * @export
 * @returns {Promise<void>}
 */
export async function setupDevTools(): Promise<void> {
  if (!isDevMode()) return;

  const {
    default: installExtension,
    REACT_DEVELOPER_TOOLS,
    REACT_PERF
  } = require('electron-devtools-installer');

  try {
    const react = await installExtension(REACT_DEVELOPER_TOOLS);
    console.log(`installDevTools: Installed ${react}`);

    const perf = await installExtension(REACT_PERF);
    console.log(`installDevTools: Installed ${perf}`);
  } catch (error) {
    console.warn(`installDevTools: Error occured:`, error);
  }
}
