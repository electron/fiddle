export const ErrorCode = {
  internal: 'internal',
  invalidArgument: 'invalid-argument',
  notFound: 'not-found',
  conflict: 'conflict',
  cancelled: 'cancelled',
  network: 'network',
  unauthorized: 'unauthorized',
  forbidden: 'forbidden',
  unavailable: 'unavailable',
  installFailed: 'install-failed',
} as const;

/** Open to any string: the CLI adds its own codes (`CliErrorCode`), and a code from another process isn't checked. */
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode] | (string & {});

export interface SerializedFiddleError {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

/** Throw it anywhere; the IPC transport carries `{ code, message, details }` across processes. Unexpected errors become `internal`. */
export class FiddleError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'FiddleError';
    this.code = code;
    this.details = details;
  }

  toJSON(): SerializedFiddleError {
    return { code: this.code, message: this.message, details: this.details };
  }

  static from(error: unknown): FiddleError {
    if (error instanceof FiddleError) return error;
    // Node's system errors (`EACCES`, `ABORT_ERR`) carry a `code` too, but only a plain object is a serialized FiddleError.
    if (!(error instanceof Error) && isSerializedFiddleError(error)) {
      return new FiddleError(error.code, error.message, error.details);
    }
    const message = error instanceof Error ? error.message : String(error);
    return new FiddleError(ErrorCode.internal, message);
  }
}

export function isSerializedFiddleError(value: unknown): value is SerializedFiddleError {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as SerializedFiddleError).code === 'string' &&
    typeof (value as SerializedFiddleError).message === 'string'
  );
}
