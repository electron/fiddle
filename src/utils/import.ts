const moduleMap: Record<string, any> = {};

/**
 * This fancy import mostly helps us to easily mock asynchronous
 * imports of modules.
 *
 * @export
 * @template T
 * @param {string} p
 * @returns {Promise<T>}
 */
export async function fancyImport<T>(p: string): Promise<T> {
  if (!moduleMap[p]) {
    moduleMap[p] = await import(p);
  }

  return moduleMap[p];
}
