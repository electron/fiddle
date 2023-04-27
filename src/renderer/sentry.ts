import * as Sentry from '@sentry/electron/renderer';

import { SENTRY_DSN } from '../constants';

export function initSentry() {
  if (!window.ElectronFiddle.isDevMode) {
    Sentry.init({ dsn: SENTRY_DSN });
  }
}
