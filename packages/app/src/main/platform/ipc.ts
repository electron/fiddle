import { app } from 'electron';

import { AppPlatform, implement } from '../../ipc/main';
import { confirmQuit } from '../documents/service';
import type { IpcContext } from '../ipc';
import { log, type LogLevel } from '../log';
import { testFlags } from '../test-mode';
import { openUpdatePage } from '../updates';
import { resetPrivacyPermissions } from './privacy';

export function bindAppPlatformIpc({
  contents,
  windowId,
  services: { hub, onboarding },
}: IpcContext): void {
  implement(AppPlatform, contents, {
    Log: (level, message) => log.fromRenderer(level as LogLevel, message),
    OpenUpdatePage: () => openUpdatePage(),
    // Never in e2e runs, like the other first-run prompts.
    TakeCrashReportsNotice: () =>
      testFlags().firstRunPrompts &&
      onboarding.takeCrashReportsNotice(hub.app.settings.crashReports),
    // After the usual unsaved-changes prompt, which can cancel it.
    Relaunch: async () => {
      if (!(await confirmQuit())) return;
      app.relaunch();
      app.quit();
    },
    ResetPrivacyPermissions: () => resetPrivacyPermissions(windowId),
    ShouldOfferTour: () => onboarding.shouldOfferTour(),
    SetTourDone: () => onboarding.setTourDone(),
  });
}
