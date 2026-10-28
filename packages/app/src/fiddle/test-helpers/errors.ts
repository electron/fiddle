/** The `details.reason` of the FiddleError thrown by `fn`, or null if it doesn't throw. */
export function thrownReason(fn: () => unknown): string | null {
  try {
    fn();
  } catch (error) {
    return ((error as { details?: { reason?: string } }).details?.reason ?? null) as
      string | null;
  }
  return null;
}
