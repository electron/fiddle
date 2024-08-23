/**
 * Are we currently running in development mode?
 */
export function isDevMode(): boolean {
  return !!process.defaultApp;
}
