
/**
 * Call this method in a certain number of milliseconds. Returns
 * a promise that resolves with the passed function.
 *
 * @template T
 * @param {number} ms
 * @param {(...args: Array<any>) => T} fn
 * @returns {Promise<T>}
 */
export function callIn<T>(ms: number, fn: (...args: Array<any>) => T): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(fn()), ms);
  });
}
