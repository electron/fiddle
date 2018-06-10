export function getMainWindowOptions(): Electron.BrowserWindowConstructorOptions {
  return {
    width: 1200,
    height: 900,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : undefined,
    acceptFirstMouse: true
  };
}
