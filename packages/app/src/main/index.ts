/**
 * Main process entry and composition root. Main owns all state (StateHub),
 * the command registry, menus, windows and the app:// protocol. See
 * CLAUDE.md "Architecture map".
 *
 * Before `ready`: Squirrel → headless CLI → test harness → crash reporting →
 * scheme and sandbox → single-instance lock and deep-link queue → main().
 * The harness comes before the lock because it moves userData, which the
 * lock is keyed on.
 */
import path from 'node:path';

import { app, BrowserWindow } from 'electron';

import { registerCommands } from './app-commands';
import { headlessArgs, startHeadless } from './cli';
import { initCrashReporting } from './crash/sentry';
import { installDevCsp } from './csp';
import { installEarlyDocumentHandlers, openFiddleWindow, startDocuments } from './documents/service';
import { initMainI18n } from './i18n';
import { initLogFile, log } from './log';
import { installMenu } from './menu';
import { runMigration } from './migration';
import { installFlushOnExit } from './persistence/lifecycle';
import { installQuitOnLastWindowClosed, startPlatform } from './platform';
import { applyChromiumLanguage } from './platform/locale';
import { handleSquirrelStartup } from './platform/squirrel';
import { handleAppProtocol, registerAppScheme } from './protocol';
import { applySessionSecurity, hardenAllWebContents } from './security';
import { createServices } from './services';
import { loadSettings, preferredLocales, startSettings } from './settings';
import { StateHub } from './state-hub';
import { installTestHarness } from './test-driver';
import { isTestMode } from './test-mode';
import { installOsIntegration, openColdStartFolder } from './ux/integration';
import { detectMaterial, detectPlatform, rendererEntry } from './window';

// Squirrel.Windows install, update and uninstall events: the app only
// creates or removes shortcuts, then quits.
const squirrelEvent = handleSquirrelStartup();

// Headless CLI (REQUIREMENTS §7): `--headless <command>` runs one command and
// exits with its code. No lock, windows, migration, updates, crash reports or stores.
const headless = squirrelEvent ? undefined : headlessArgs(process.argv);
if (headless) startHeadless(headless);

// Test builds only (CLAUDE.md "E2E"): temp dirs, stubs, network guard and the
// e2e driver, before anything reads app paths. Release builds compile it out.
const testHarness = __FIDDLE_TEST_BUILD__ && isTestMode() ? installTestHarness() : undefined;

// Sentry starts before `ready`, if "Send crash reports" allows it (off in dev, test and headless mode).
if (!squirrelEvent) initCrashReporting();

// Both must happen before `ready`.
registerAppScheme();
app.enableSandbox();
// Chromium's UI language (`--lang`) follows the language setting (§9).
if (!squirrelEvent && !headless) applyChromiumLanguage();

// The single-instance lock, and deep links (`argv`, `second-instance`,
// `open-url`) and `open-file` queued until the windows are up.
const primary = !squirrelEvent && !headless && installEarlyDocumentHandlers();

async function main(): Promise<void> {
  await app.whenReady();

  // 1. Disk. Quit on the last window closed (not on macOS), installed before
  // the import so its hidden reader window never quits the app. Then the log
  // file, then the one-time import, which must finish before any store exists.
  installQuitOnLastWindowClosed();
  initLogFile(path.join(app.getPath('userData'), 'logs'));
  const migration = await runMigration();

  // 2. State: settings, i18n, the StateHub, flushing every store on quit.
  const platform = detectPlatform();
  const settingsFile = loadSettings();
  const locale = await initMainI18n(preferredLocales(settingsFile.store));
  const hub = new StateHub(
    // `dev`: unpackaged (development and test) builds get the Develop menu and its commands.
    { locale, platform, material: detectMaterial(platform), dev: !app.isPackaged, ...settingsFile.initialApp },
    (error) => log.error('store push failed', error),
  );
  installFlushOnExit();
  const settings = await startSettings(hub, settingsFile.store);

  // 3. Security and the app:// protocol (or the Vite dev server).
  applySessionSecurity();
  hardenAllWebContents();
  const entry = rendererEntry();
  if (entry.devServerUrl) {
    log.info('loading the renderer from the Vite dev server', entry.devServerUrl);
    installDevCsp(entry.devServerUrl);
  } else {
    await handleAppProtocol(entry.rendererDir);
  }

  // 4. Services, each created once.
  const services = await createServices({ hub, settings, platform, rendererUrl: entry.url });

  // 5. Commands and the menu.
  registerCommands(services.registry, services);
  testHarness?.attach(services);
  installMenu(services);

  // 6. Platform (About panel, protocol, updates, first-run prompts) and OS
  // integration, then windows: the last session, or a new fiddle.
  await startPlatform(hub, migration.firstLaunch);
  installOsIntegration(services);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void openFiddleWindow();
  });
  await startDocuments();
  // A Windows jump list task that started the app opens its folder now.
  openColdStartFolder();
}

if (primary) {
  main().catch((error: unknown) => {
    log.error('startup failed', error);
    app.exit(1);
  });
} else if (!squirrelEvent && !headless) {
  // Another instance has the lock; it got our deep link or focus request.
  app.quit();
}
