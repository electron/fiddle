import * as LodashType from 'lodash';

let _lodash: typeof LodashType | null = null;

/**
 * Returns a loaded Octokit.
 *
 * @export
 * @returns {Promise<typeof LodashType>}
 */
export async function getLodash(): Promise<typeof LodashType> {
  return _lodash = _lodash || await import('lodash');
}
