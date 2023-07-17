import * as Sentry from '@sentry/electron/main';

import { isDevMode } from './utils/devmode';
import { SENTRY_DSN } from '../constants';

export function initSentry() {
  if (!isDevMode()) {
    Sentry.init({ dsn: SENTRY_DSN });
  }
}
