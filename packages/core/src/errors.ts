/**
 * Stable error codes carried by {@link FiddleCoreError}.
 *
 * - `invalid-version`: not a valid Electron version.
 * - `invalid-fiddle`: the fiddle source could not be resolved.
 * - `not-installed`: an Electron executable could not be found or installed.
 * - `already-installing`: the version is already being installed by this Installer.
 * - `download-failed`: downloading a release or the releases list failed.
 * - `extract-failed`: extracting a downloaded release failed.
 * - `aborted`: the operation was cancelled through its `AbortSignal`.
 * - `locked`: a cache lock could not be acquired in time.
 */
export type FiddleCoreErrorCode =
  | 'invalid-version'
  | 'invalid-fiddle'
  | 'not-installed'
  | 'already-installing'
  | 'download-failed'
  | 'extract-failed'
  | 'aborted'
  | 'locked';

/**
 * An `Error` with a stable {@link FiddleCoreErrorCode}.
 *
 * Messages match the plain `Error`s that fiddle-core 2.x threw. `name` stays
 * `'Error'` and `code` is non-enumerable, so these errors still compare equal
 * to the old ones (e.g. with `expect(...).toEqual(new Error(message))`).
 */
export class FiddleCoreError extends Error {
  declare public readonly code: FiddleCoreErrorCode;

  constructor(code: FiddleCoreErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    Object.defineProperty(this, 'code', { value: code, enumerable: false });
  }
}

export function isFiddleCoreError(
  err: unknown,
  code?: FiddleCoreErrorCode,
): err is FiddleCoreError {
  return err instanceof FiddleCoreError && (code === undefined || err.code === code);
}

/**
 * How errors are reported. Pass it as the `errors` option of `Installer`,
 * `Runner.create()` and `ElectronVersions.create()`.
 *
 * - `legacy` (default): as in fiddle-core 2.x. Download and extract failures
 *   throw the original error, and aborting a `Runner` `signal` resolves
 *   `system_error`.
 * - `typed`: download and extract failures are wrapped in a
 *   {@link FiddleCoreError} (`download-failed`, `extract-failed`) with the
 *   original error in `cause`, and `Runner.run()` and `bisect()` reject with
 *   an `aborted` error when their `signal` aborts.
 */
export type ErrorMode = 'legacy' | 'typed';

/** In `typed` mode, wraps `err` in a {@link FiddleCoreError}. Otherwise returns it. */
export function wrapError(
  mode: ErrorMode | undefined,
  code: FiddleCoreErrorCode,
  err: unknown,
): unknown {
  if (mode !== 'typed') return err;
  const message = err instanceof Error ? err.message : String(err);
  return new FiddleCoreError(code, message, { cause: err });
}

export function abortError(signal?: AbortSignal): FiddleCoreError {
  return new FiddleCoreError('aborted', 'The operation was aborted', {
    cause: signal?.reason,
  });
}

/** Throws an `aborted` {@link FiddleCoreError} if `signal` is aborted. */
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError(signal);
}
