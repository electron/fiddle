import { isDevMode } from './utils/devmode';

if (isDevMode()) {
  require('@electron/devtron').devtron.install();
}
