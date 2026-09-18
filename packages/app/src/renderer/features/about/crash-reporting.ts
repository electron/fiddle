/**
 * Sentry in the renderer. It starts only when main's
 * Sentry is on (packaged, not test or headless, "Send crash reports" on).
 *
 * Events travel to main over Sentry's classic IPC, exposed by the app's own
 * preload, and main's `beforeSend` scrubs them there. The integrations are an
 * explicit allowlist: no breadcrumbs integration, so no console, DOM or
 * network breadcrumbs.
 */
import { appPlatformApi } from '../../../ipc/renderer';

export async function initRendererCrashReporting(): Promise<void> {
  if (!(await appPlatformApi.IsCrashReportingEnabled())) return;
  const Sentry = await import('@sentry/electron/renderer');
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
