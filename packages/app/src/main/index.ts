/**
 * Main process entry. Main owns all state (StateHub), the command registry,
 * menus, windows and the app:// protocol. See CLAUDE.md "Architecture map".
 */
import { app, BrowserWindow } from 'electron';

import { registerCommands } from './app-commands';
import { CommandRegistry } from './commands';
import { installDevCsp } from './csp';
import { initMainI18n } from './i18n';
import { log } from './log';
import { installMenu } from './menu';
import { handleAppProtocol, registerAppScheme } from './protocol';
import { applySessionSecurity, hardenAllWebContents } from './security';
import { StateHub } from './state-hub';
import { createAppWindow, detectMaterial, detectPlatform, rendererEntry } from './window';

// Both must happen before `ready`.
registerAppScheme();
app.enableSandbox();

async function main(): Promise<void> {
  await app.whenReady();

  const platform = detectPlatform();
  const locale = await initMainI18n(app.getPreferredSystemLanguages());
  const hub = new StateHub(
    { locale, platform, material: detectMaterial(platform) },
    (error) => log.error('store push failed', error),
  );

  applySessionSecurity();
  hardenAllWebContents();

  const entry = rendererEntry();
  if (entry.devServerUrl) {
    log.info('loading the renderer from the Vite dev server', entry.devServerUrl);
    installDevCsp(entry.devServerUrl);
  } else {
    await handleAppProtocol(entry.rendererDir);
  }

  const registry = new CommandRegistry(hub);
  const openWindow = () => createAppWindow({ hub, registry, url: entry.url, platform });
  registerCommands(registry, openWindow);
  installMenu(registry, hub, platform);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void openWindow();
  });
  app.on('window-all-closed', () => {
    if (platform !== 'darwin') app.quit();
  });

  await openWindow();
}

main().catch((error: unknown) => {
  log.error('startup failed', error);
  app.exit(1);
});
