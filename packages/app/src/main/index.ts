/**
 * Main process entry. Main owns all state (StateHub), the command registry,
 * menus, windows and the app:// protocol. See CLAUDE.md "Architecture map".
 */
import { app, BrowserWindow } from 'electron';

import { registerCommands } from './app-commands';
import { CommandRegistry } from './commands';
import { installDevCsp } from './csp';
import {
  initDocuments,
  installEarlyDocumentHandlers,
  openFiddleWindow,
  startDocuments,
} from './documents/service';
import { initMainI18n } from './i18n';
import { log } from './log';
import { initRunServices } from './run';
import { installMenu } from './menu';
import { installFlushOnExit } from './persistence/lifecycle';
import { loadSettings, preferredLocales, startSettings } from './settings';
import { handleAppProtocol, registerAppScheme } from './protocol';
import { applySessionSecurity, hardenAllWebContents } from './security';
import { StateHub } from './state-hub';
import { installTestHarness } from './test-driver';
import { isTestMode } from './test-mode';
import { createAppWindow, detectMaterial, detectPlatform, rendererEntry } from './window';
// Platform slice.
import path from 'node:path';
import { initCrashReporting } from './crash/sentry';
import { initLogFile } from './log';
import { runMigration } from './migration';
import { installQuitOnLastWindowClosed, startPlatform } from './platform';
import { handleSquirrelStartup } from './platform/squirrel';

// Platform slice: Squirrel.Windows install, update and uninstall events come
// first. For those the app only creates or removes shortcuts, then quits.
const squirrelEvent = handleSquirrelStartup();

// Test builds only (see CLAUDE.md "E2E"): temp dirs, stubs, network guard and
// the e2e driver. Release builds compile all of it out. Runs first, before
// anything reads app paths or takes the single-instance lock.
const testHarness =
  __FIDDLE_TEST_BUILD__ && isTestMode() ? installTestHarness() : undefined;

// Platform slice: Sentry starts before `ready`, if the "Send crash reports"
// setting allows it (off in dev, test and headless mode).
if (!squirrelEvent) initCrashReporting();

// Both must happen before `ready`.
registerAppScheme();
app.enableSandbox();

async function main(): Promise<void> {
  await app.whenReady();
  // Platform slice: quit on the last window closed (not on macOS), installed
  // before the import so its hidden reader window closing never quits. Then
  // JSON-lines logs, then the one-time import from the previous app, which
  // must finish before any store (settings.json, state.json…) exists.
  installQuitOnLastWindowClosed();
  initLogFile(path.join(app.getPath('userData'), 'logs'));
  const migration = await runMigration();

  const platform = detectPlatform();
  const settings = loadSettings();
  const locale = await initMainI18n(preferredLocales(settings.store));
  const hub = new StateHub(
    { locale, platform, material: detectMaterial(platform), ...settings.initialApp },
    (error) => log.error('store push failed', error),
  );
  installFlushOnExit();

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
  testHarness?.attach({ hub, registry });
  // Versions and run slice: the release list, installs and runs. Documents
  // asks it for the default version, so it starts first.
  await initRunServices(hub).ready;
  // Documents slice: every window opens with a fiddle (or its restored session).
  initDocuments({
    hub,
    platform,
    createWindow: (windowId, init) =>
      createAppWindow({ hub, registry, url: entry.url, platform, windowId, init }),
  });
  const openWindow = () => openFiddleWindow();
  registerCommands(registry, openWindow);
  await startSettings({ hub, registry, store: settings.store });
  // Platform slice: Help commands, About panel, protocol, move to
  // /Applications (first launch), updates and crash-report prompts.
  await startPlatform({ hub, registry, firstLaunch: migration.firstLaunch });
  installMenu(registry, hub, platform);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void openWindow();
  });

  await startDocuments();
}

// Documents slice: the single-instance lock and deep-link delivery start before `ready`.
if (squirrelEvent) {
  // Platform slice: handleSquirrelStartup() quits once Update.exe is done.
} else if (installEarlyDocumentHandlers()) {
  main().catch((error: unknown) => {
    log.error('startup failed', error);
    app.exit(1);
  });
} else {
  app.quit();
}
