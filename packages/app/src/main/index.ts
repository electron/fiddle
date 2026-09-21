import path from 'node:path';

import { app, BrowserWindow, dialog } from 'electron';

import { registerCommands } from './app-commands';
import { headlessArgs, startHeadless } from './cli';
import { initCrashReporting } from './crash/sentry';
import { installDevCsp } from './csp';
import {
  flushDraftsAndSession,
  installEarlyDocumentHandlers,
  openFiddleWindow,
  startDocuments,
} from './documents/service';
import { initMainI18n } from './i18n';
import { flushLog, initLogFile, log, logProcessErrors, logsDir } from './log';
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

const squirrelEvent = handleSquirrelStartup();

// `--headless <command>` runs one command and exits: no lock, windows, migration, updates, crash reports or stores.
const headless = squirrelEvent ? undefined : headlessArgs(process.argv);
if (headless) startHeadless(headless);

// Before anything reads app paths, and before the single-instance lock, which is
// keyed on the userData the harness moves. Compiled out of other builds.
const testHarness =
  __FIDDLE_TEST_BUILD__ && isTestMode() ? installTestHarness() : undefined;

if (!squirrelEvent) initCrashReporting(headless !== undefined);
if (!squirrelEvent && !headless) logProcessErrors();

// Both must happen before `ready`.
registerAppScheme();
app.enableSandbox();
if (!squirrelEvent && !headless) applyChromiumLanguage();

const primary = !squirrelEvent && !headless && installEarlyDocumentHandlers();

async function main(): Promise<void> {
  await app.whenReady();

  // Before the import, so its hidden reader window never quits the app.
  installQuitOnLastWindowClosed();
  initLogFile(path.join(app.getPath('userData'), 'logs'));
  const migration = await runMigration();

  const platform = detectPlatform();
  const settingsFile = loadSettings();
  const locale = await initMainI18n(preferredLocales(settingsFile.store));
  const hub = new StateHub(
    {
      locale,
      platform,
      material: detectMaterial(platform),
      dev: !app.isPackaged,
      ...settingsFile.initialApp,
    },
    (error) => log.error('store push failed', error),
  );
  installFlushOnExit(flushDraftsAndSession);
  const settings = await startSettings(hub, settingsFile.store);

  applySessionSecurity();
  hardenAllWebContents();
  const entry = rendererEntry();
  if (entry.devServerUrl) {
    log.info('loading the renderer from the Vite dev server', entry.devServerUrl);
    installDevCsp(entry.devServerUrl);
  } else {
    await handleAppProtocol(entry.rendererDir);
  }

  const services = await createServices({
    hub,
    settings,
    platform,
    rendererUrl: entry.url,
  });

  registerCommands(services.registry, services);
  testHarness?.attach(services);
  installMenu(services);

  await startPlatform(hub, migration.firstLaunch);
  installOsIntegration(services);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      openFiddleWindow().catch((error: unknown) =>
        log.error('could not open a window', error),
      );
    }
  });
  await startDocuments();
  openColdStartFolder();
}

/** A failed startup leaves no window: the reason goes to the log file and an error box, then the app exits. */
async function failStartup(error: unknown): Promise<void> {
  log.error('startup failed', error);
  try {
    if (!logsDir()) initLogFile(path.join(app.getPath('userData'), 'logs'));
    await flushLog();
  } catch {
    // The console has the entry.
  }
  if (!isTestMode())
    dialog.showErrorBox(
      app.getName(),
      error instanceof Error ? error.message : String(error),
    );
  app.exit(1);
}

if (primary) {
  void main().catch(failStartup);
} else if (!squirrelEvent && !headless) {
  // Another instance has the lock; it got our deep link or focus request.
  app.quit();
}
