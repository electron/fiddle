import * as GitHubType from '@octokit/rest';

let _Octokit: typeof GitHubType;
let _octo: GitHubType;

/**
 * Returns a loaded Octokit.
 *
 * @export
 * @returns {Promise<typeof GitHubType>}
 */
export async function getOctokit(): Promise<GitHubType> {
  _Octokit = _Octokit || await import('@octokit/rest');
  return _octo = _octo || new _Octokit();
}
