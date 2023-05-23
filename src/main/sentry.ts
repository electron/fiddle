import * as Sentry from '@sentry/electron/main';

import { SENTRY_DSN } from '../constants';
import { isDevMode } from './utils/devmode';

export function initSentry() {
  if (!isDevMode()) {
    Sentry.init({ dsn: SENTRY_DSN });
  }
}
