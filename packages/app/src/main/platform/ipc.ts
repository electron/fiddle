/**
 * Binds `interface AppPlatform` (fiddle.eipc) for one window: renderer logs,
 * whether crash reporting is on, and the update toast's action. The
 * `UpdateAvailable` event is dispatched from ../updates.
 */
import { AppPlatform, implement } from '../../ipc/main';
import { isCrashReportingEnabled } from '../crash/sentry';
import type { IpcContext } from '../ipc';
import { log, type LogLevel } from '../log';
import { testFlags } from '../test-mode';
import { openUpdatePage } from '../updates';

export function bindAppPlatformIpc({ contents, services: { hub, onboarding } }: IpcContext): void {
  implement(AppPlatform, contents, {
    Log: (level, message) => log.fromRenderer(level as LogLevel, message),
    IsCrashReportingEnabled: () => isCrashReportingEnabled(),
    OpenUpdatePage: () => openUpdatePage(),
    // Never in e2e runs, like the other first-run prompts.
    TakeCrashReportsNotice: () =>
      testFlags().firstRunPrompts && onboarding.takeCrashReportsNotice(hub.app.settings.crashReports),
  });
}
