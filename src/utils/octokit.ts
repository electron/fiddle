import { Octokit } from '@octokit/rest';
import { AppState } from '../renderer/state';

let _octo: Octokit;

/**
 * Returns a loaded Octokit. If state is passed and authentication
 * is available, we'll token-authenticate.
 *
 * @export
 * @returns {Promise<typeof GitHubType>}
 */
export async function getOctokit(appState?: AppState): Promise<Octokit> {
  // It's possible to load Gists without being authenticated,
  // but we get better rate limits when authenticated.
  _octo =
    _octo || appState?.gitHubToken
      ? new Octokit({
          auth: appState?.gitHubToken,
        })
      : new Octokit();

  return _octo;
}
