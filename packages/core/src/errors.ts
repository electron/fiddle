/**
 * Stable error codes carried by {@link FiddleCoreError}.
 *
 * - `invalid-version`: not a valid Electron version.
 * - `not-installed`: an Electron executable could not be found or installed.
 * - `aborted`: the operation was cancelled through its `AbortSignal`.
 */
export type FiddleCoreErrorCode = 'invalid-version' | 'not-installed' | 'aborted';

/**
 * An `Error` with a stable {@link FiddleCoreErrorCode}.
 *
 * `name` stays `'Error'` and `code` is non-enumerable, so these errors still
 * compare equal to a plain `Error` with the same message (e.g. with
 * `expect(...).toEqual(new Error(message))`).
 */
export class FiddleCoreError extends Error {
  declare public readonly code: FiddleCoreErrorCode;

  constructor(code: FiddleCoreErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    Object.defineProperty(this, 'code', { value: code, enumerable: false });
  }
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
