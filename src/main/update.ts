/**
 * Sets up the update service
 */
export function setupUpdates() {
  // We delay this work by 10s to ensure that the
  // app doesn't have to worry about updating during launch
  setTimeout(() => {
    const { updateElectronApp } = require('update-electron-app');

    updateElectronApp({
      repo: 'electron/fiddle',
      updateInterval: '1 hour',
    });
  }, 10000);
}
