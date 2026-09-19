import { appPlatformApi } from '../../../ipc/renderer';

export async function initRendererCrashReporting(): Promise<void> {
  if (!(await appPlatformApi.IsCrashReportingEnabled())) return;
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
