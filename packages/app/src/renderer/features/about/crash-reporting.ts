/** `enabled`: `App.crashReporting`, whether main started Sentry. */
export async function initRendererCrashReporting(enabled?: boolean): Promise<void> {
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
