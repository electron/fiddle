const isContainer = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype);

/** `next`, with every part equal to the same part of `prev` replaced by `prev`'s own object. Plain objects and arrays only. */
export function shareEqual<T>(prev: unknown, next: T): T {
  if (Object.is(prev, next)) return next;
  if (
    !isContainer(prev) ||
    !isContainer(next) ||
    Array.isArray(prev) !== Array.isArray(next)
  )
    return next;
  const keys = Object.keys(next);
  let same = Object.keys(prev).length === keys.length;
  const merged = (Array.isArray(next) ? [] : {}) as Record<string, unknown>;
  for (const key of keys) {
    merged[key] = shareEqual(prev[key], next[key]);
    if (!Object.hasOwn(prev, key) || merged[key] !== prev[key]) same = false;
  }
  return (same ? prev : merged) as T;
}
