import { ErrorCode, type FiddleError } from '../../../shared/errors';

/**
 * The hint after a failed publish, update or delete: ownership for a 404 or a
 * 403, connectivity when GitHub can't be reached or is down. None for a rate
 * limit or a window without a gist, which say what is wrong themselves.
 */
export function gistErrorHint(
  error: FiddleError,
): 'hintOwnership' | 'hintConnectivity' | undefined {
  const reason = (error.details as { reason?: unknown } | undefined)?.reason;
  if (reason === 'rate-limited' || reason === 'no-gist') return undefined;
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
