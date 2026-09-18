import { ErrorCode, type FiddleError } from '../../../shared/errors';

/**
 * The hint after a failed publish, update or delete.
 * Ownership for a 404 or a 403 (the GitHub client reports a rate-limited 403
 * as `unavailable`), connectivity when GitHub can't be reached, none otherwise.
 */
export function gistErrorHint(
  error: FiddleError,
): 'hintOwnership' | 'hintConnectivity' | undefined {
  switch (error.code) {
    case ErrorCode.notFound:
    case ErrorCode.forbidden:
      return 'hintOwnership';
    case ErrorCode.network:
    case ErrorCode.unavailable:
      return 'hintConnectivity';
    default:
      return undefined;
  }
}
