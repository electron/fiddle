import { Octokit } from '@octokit/rest';
import { AppState } from '../renderer/state';

let _octo: Octokit;

/**
 * Returns a loaded Octokit. If state is passed and authentication
 * is available, we'll token-authenticate.
 *
 * @export
 * @returns {Octokit}
 */
export function getOctokit(appState?: AppState): Octokit {
  _octo = _octo || new Octokit();

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
