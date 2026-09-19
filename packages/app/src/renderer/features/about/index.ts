import type { i18n } from 'i18next';

import { showCrashReportsNotice } from './crash-notice';
import { initRendererCrashReporting } from './crash-reporting';
import { forwardUncaughtErrors, log } from './log';
import { listenForUpdateNotices } from './update-notice';

export { log } from './log';

export async function installPlatformRenderer(i18n: i18n): Promise<void> {
  forwardUncaughtErrors();
  const results = await Promise.allSettled([
    initRendererCrashReporting(),
    listenForUpdateNotices(i18n),
    showCrashReportsNotice(i18n),
  ]);
  for (const result of results) {
    if (result.status === 'rejected') log.error('platform setup failed', result.reason);
  }
}
