import type mainErrors from '../i18n/generated/en/mainErrors';
import { type ErrorCode, FiddleError } from '../shared/errors';

/**
 * The `details.reason` values that main turns into a translated message: the
 * keys of the `mainErrors` catalog, whose placeholders are named after the
 * error's other details.
 */
export type ErrorReason = keyof typeof mainErrors;

/** `message` stays English for logs and tests; main shows the catalog text for `reason`. */
export function reasonError(
  code: ErrorCode,
  reason: ErrorReason,
  message: string,
  details: Record<string, unknown> = {},
): FiddleError {
  return new FiddleError(code, message, { ...details, reason });
}
