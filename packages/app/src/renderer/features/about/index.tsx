import type { i18n } from 'i18next';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { appPlatformApi } from '../../../ipc/renderer';
import type { AppState } from '../../../shared/stores';
import { showToast } from '../../../ui/components/Toast';
import { useAppState } from '../../state';
import { openSettingsSection } from '../settings/sections';
import { forwardUncaughtErrors, log } from './log';

export { log } from './log';

/** `enabled`: `App.crashReporting`, whether main started Sentry. */
async function initRendererCrashReporting(enabled?: boolean): Promise<void> {
  if (!enabled) return;
  const Sentry = await import('@sentry/electron/renderer');
  // Events go to main, whose `beforeSend` scrubs them. The integrations are an allowlist:
  // no breadcrumbs, so no console, DOM or network breadcrumbs.
  Sentry.init({
    sendDefaultPii: false,
    defaultIntegrations: false,
    integrations: [
      Sentry.globalHandlersIntegration(),
      Sentry.browserApiErrorsIntegration(),
      Sentry.linkedErrorsIntegration(),
      Sentry.dedupeIntegration(),
      Sentry.functionToStringIntegration(),
      Sentry.scopeToMainIntegration(),
    ],
  });
}

/** The one-time notice that crash reports are on, with a way to the privacy settings. */
export async function showCrashReportsNotice(i18n: i18n): Promise<void> {
  await i18n.loadNamespaces('about');
  if (!(await appPlatformApi.TakeCrashReportsNotice())) return;
  const t = i18n.getFixedT(null, 'about');
  showToast({
    tone: 'info',
    title: t('crashNoticeTitle'),
    description: t('crashNoticeDescription'),
    actionLabel: t('crashNoticeAction'),
    onAction: () => void openSettingsSection('privacy', t('openSettingsFailed')),
  });
}

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

/** Linux and MSIX: a toast for each newer release main finds, offering its download page. */
export function UpdateNotice() {
  const { i18n } = useTranslation();
  const version = useAppState()?.updateAvailable;
  useEffect(() => {
    if (!version) return;
    void i18n.loadNamespaces('about').then(() => {
      const t = i18n.getFixedT(null, 'about');
      showToast({
        tone: 'info',
        title: t('updateAvailableTitle'),
        description: t('updateAvailableDescription', { version }),
        actionLabel: t('download'),
        onAction: () => void appPlatformApi.OpenUpdatePage(),
      });
    });
  }, [i18n, version]);
  return null;
}
