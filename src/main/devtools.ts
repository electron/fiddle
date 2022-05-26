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
  } = require('electron-devtools-installer');

  try {
    const react = await installExtension(REACT_DEVELOPER_TOOLS, {
      loadExtensionOptions: { allowFileAccess: true },
    });
    console.log(`installDevTools: Installed ${react}`);
  } catch (error) {
    console.warn(`installDevTools: Error occurred:`, error);
  }
}
