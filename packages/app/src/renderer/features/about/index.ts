import type { i18n } from 'i18next';

import type { AppState } from '../../../shared/stores';
import { showCrashReportsNotice } from './crash-notice';
import { initRendererCrashReporting } from './crash-reporting';
import { forwardUncaughtErrors, log } from './log';

export { log } from './log';

export async function installPlatformRenderer(i18n: i18n, app?: AppState): Promise<void> {
  forwardUncaughtErrors();
  const results = await Promise.allSettled([
    initRendererCrashReporting(app?.crashReporting),
    showCrashReportsNotice(i18n),
  ]);
  for (const result of results) {
    if (result.status === 'rejected') log.error('platform setup failed', result.reason);
  }
}
