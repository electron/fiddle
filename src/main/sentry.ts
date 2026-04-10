import * as Sentry from '@sentry/electron/main';

import { isDevMode } from './utils/devmode';
import { SENTRY_DSN } from '../constants';

if (!isDevMode()) {
  Sentry.init({ dsn: SENTRY_DSN });
}
