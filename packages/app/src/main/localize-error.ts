import { ERROR_REASONS } from '../fiddle/error-reasons';
import { FiddleError } from '../shared/errors';
import { tm } from './i18n';

const reasons: readonly unknown[] = ERROR_REASONS;

/**
 * The same error with the message translated, when `details.reason` names a
 * `mainErrors` string. Any other error comes back as it is. The detail fields
 * fill the placeholders.
 */
export function localizeError(error: FiddleError): FiddleError {
  const details = error.details;
  if (typeof details !== 'object' || details === null) return error;
  const reason = (details as { reason?: unknown }).reason;
  if (!reasons.includes(reason)) return error;
  const t = tm('mainErrors') as unknown as (
    key: string,
    options: { replace: object },
  ) => string;
  const message = t(reason as string, { replace: details });
  return message === reason ? error : new FiddleError(error.code, message, details);
}

/** The user-facing text of any thrown value. */
export function errorMessage(error: unknown): string {
  return localizeError(FiddleError.from(error)).message;
}
