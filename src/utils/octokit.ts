import { Octokit } from '@octokit/rest';
import { AppState } from '../renderer/state';

let _Octokit: typeof Octokit;
let _octo: Octokit;

/**
 * Returns a loaded Octokit. If state is passed and authentication
 * is available, we'll token-authenticate.
 *
 * @export
 * @returns {Promise<typeof GitHubType>}
 */
export async function getOctokit(appState?: AppState): Promise<Octokit> {
  _Octokit = _Octokit || ((await import('@octokit/rest')) as any).default;
  _octo = _octo || new _Octokit();

  // You can load Gists without being authenticated,
  // but we get better rate limits when authenticated
  if (appState && appState.gitHubToken) {
    _octo.authenticate({
      type: 'token',
      token: appState.gitHubToken!,
    });
  }

  return _octo;
}
