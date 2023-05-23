/**
 * Are we currently running in development mode?
 *
 * @returns {boolean}
 */
export function isDevMode(): boolean {
  return !!process.defaultApp;
}
