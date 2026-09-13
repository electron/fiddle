/**
 * Binds `interface AppPlatform` (fiddle.eipc) for one window: renderer logs,
 * whether crash reporting is on, and the update toast's action. The
 * `UpdateAvailable` event is dispatched from ../updates.
 */
import type { WebContents } from 'electron';

import { AppPlatform, implement } from '../../ipc/main';
import { isCrashReportingEnabled } from '../crash/sentry';
import { log, type LogLevel } from '../log';
import { openUpdatePage } from '../updates';

export function bindAppPlatformIpc(contents: WebContents): void {
  implement(AppPlatform, contents, {
    Log: (level, message) => log.fromRenderer(level as LogLevel, message),
    IsCrashReportingEnabled: () => isCrashReportingEnabled(),
    OpenUpdatePage: () => openUpdatePage(),
  });
}
