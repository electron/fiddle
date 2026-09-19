import { AppPlatform, implement } from '../../ipc/main';
import { isCrashReportingEnabled } from '../crash/sentry';
import type { IpcContext } from '../ipc';
import { log, type LogLevel } from '../log';
import { testFlags } from '../test-mode';
import { openUpdatePage } from '../updates';
import { relaunchApp } from './locale';
import { resetPrivacyPermissions } from './privacy';

export function bindAppPlatformIpc({
  contents,
  windowId,
  services: { hub, onboarding },
}: IpcContext): void {
  implement(AppPlatform, contents, {
    Log: (level, message) => log.fromRenderer(level as LogLevel, message),
    IsCrashReportingEnabled: () => isCrashReportingEnabled(),
    OpenUpdatePage: () => openUpdatePage(),
    // Never in e2e runs, like the other first-run prompts.
    TakeCrashReportsNotice: () =>
      testFlags().firstRunPrompts &&
      onboarding.takeCrashReportsNotice(hub.app.settings.crashReports),
    Relaunch: () => relaunchApp(),
    ResetPrivacyPermissions: () => resetPrivacyPermissions(windowId),
  });
}
