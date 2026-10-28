/**
 * IPC can't carry an error's class or properties, only its message. Main
 * serializes `{ code, message, details }` into it (`wrapImplementation`) and the
 * renderer re-throws a `FiddleError` (`wrapRendererApi`). No Electron imports.
 */
import {
  ErrorCode,
  FiddleError,
  isSerializedFiddleError,
  type SerializedFiddleError,
} from './errors';

export const ERROR_MARKER = '@@FiddleError@@';

export type ErrorLogger = (error: unknown) => void;
/** Rewrites a `FiddleError` (its message, say) before it crosses the boundary. */
export type ErrorTransform = (error: FiddleError) => FiddleError;

export function serializeError(
  error: unknown,
  log: ErrorLogger,
  transform?: ErrorTransform,
): SerializedFiddleError {
  if (error instanceof FiddleError) return (transform?.(error) ?? error).toJSON();
  log(error);
  const message = error instanceof Error ? error.message : String(error);
  return { code: ErrorCode.internal, message };
}

/** The error main throws back to EIPC: its message carries the serialized error. */
export function encodeError(
  error: unknown,
  log: ErrorLogger,
  transform?: ErrorTransform,
): Error {
  const serialized = serializeError(error, log, transform);
  let payload: string;
  try {
    payload = JSON.stringify(serialized);
  } catch {
    // Details that can't be serialized are dropped, never the error itself.
    payload = JSON.stringify({ code: serialized.code, message: serialized.message });
  }
  return new Error(ERROR_MARKER + payload);
}

/**
 * Turns whatever an IPC call rejected with into a `FiddleError`. Electron
 * prefixes the message ("Error invoking remote method '…': Error: "), so the
 * marker is searched for rather than expected at the start.
 */
export function decodeError(error: unknown): FiddleError {
  if (error instanceof FiddleError) return error;
  const message = error instanceof Error ? error.message : String(error);
  const index = message.indexOf(ERROR_MARKER);
  if (index !== -1) {
    try {
      const parsed: unknown = JSON.parse(message.slice(index + ERROR_MARKER.length));
      if (isSerializedFiddleError(parsed)) return FiddleError.from(parsed);
    } catch {
      // Fall through: a malformed payload is an internal error.
    }
  }
  return new FiddleError(ErrorCode.internal, message);
}

type AnyFunction = (...args: unknown[]) => unknown;

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PromiseLike<unknown>).then === 'function'
  );
}

/**
 * Main side: wraps every method of an EIPC implementation so that anything it
 * throws (sync or async) reaches the renderer as a serialized `FiddleError`.
 */
export function wrapImplementation<T extends object>(
  impl: T,
  log: ErrorLogger,
  transform?: ErrorTransform,
): T {
  const wrapped: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(impl)) {
    if (typeof value !== 'function') {
      wrapped[name] = value;
      continue;
    }
    const fn = value as AnyFunction;
    wrapped[name] = async (...args: unknown[]) => {
      try {
        return await fn.apply(impl, args);
      } catch (error) {
        throw encodeError(error, log, transform);
      }
    };
  }
  return wrapped as T;
}

/**
 * Renderer side: wraps the generated API (and nested objects such as
 * `AppStore`) so every rejected or thrown error is a `FiddleError`.
 */
export function wrapRendererApi<T extends object>(api: T): T {
  const wrapped: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(api)) {
    if (typeof value === 'function') {
      const fn = value as AnyFunction;
      wrapped[name] = (...args: unknown[]) => {
        let result: unknown;
        try {
          result = fn(...args);
        } catch (error) {
          throw decodeError(error);
        }
        if (isPromiseLike(result)) {
          return Promise.resolve(result).catch((error: unknown) => {
            throw decodeError(error);
          });
        }
        return result;
      };
    } else if (typeof value === 'object' && value !== null) {
      wrapped[name] = wrapRendererApi(value);
    } else {
      wrapped[name] = value;
    }
  }
  return wrapped as T;
}
