import * as fs from 'node:fs';
import * as path from 'node:path';
import * as util from 'node:util';

import logSymbols from 'log-symbols';

const { GITHUB_TOKEN, GH_TOKEN } = process.env;
const CONTRIBUTORS_FILE_PATH = path.join(
  __dirname,
  '../static/contributors.json',
);
const CONTRIBUTORS_URL =
  'https://api.github.com/repos/electron/fiddle/contributors?per_page=100';
const HEADERS: Record<string, string> =
  GITHUB_TOKEN || GH_TOKEN
    ? {
        Authorization: `Bearer ${GITHUB_TOKEN || GH_TOKEN}`,
      }
    : {};

interface GitHubContributorInfo {
  html_url: string;
  url: string;
  login: string;
  avatar_url: string;
  type: string;
  contributions: number;
}

interface ContributorInfo {
  url: string;
  api: string;
  login: string;
  avatar: string;
  name: string | null;
  bio: string | null;
  location: string | null;
}

export async function maybeFetchContributors(silent?: boolean): Promise<void> {
  try {
    const stats = fs.statSync(CONTRIBUTORS_FILE_PATH);
    const mtime = new Date(util.inspect(stats.mtime));
    const maxAge = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);

    if (mtime < maxAge) {
      // File exists, but is too old
      if (!silent) {
        console.log(
          logSymbols.warning,
          'Contributors file on disk, but older than 24 hours.',
        );
      }
      await fetchAndWriteContributorsFile();
    } else {
      const contributors = JSON.parse(
        await fs.promises.readFile(CONTRIBUTORS_FILE_PATH, 'utf-8'),
      );
      if (contributors.length === 0) {
        // File exists, but is empty
        await fetchAndWriteContributorsFile();
      } else {
        if (!silent) {
          console.log(
            logSymbols.success,
            'Contributors file on disk and recent.',
          );
        }
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File does not exist, move to fetch right away
      await fetchAndWriteContributorsFile();
    } else if (error) {
      throw error;
    }
  }
}

/**
 * Helpers
 */

/**
 * Fetch the name for a contributor
 *
 * @param contributor - Contributor object
 */
async function fetchDetailsContributor(contributor: {
  api: string;
}): Promise<ContributorInfo> {
  const response = await fetch(contributor.api, { headers: HEADERS });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch contributor details from ${contributor.api}: ${response.status} ${response.statusText}`,
    );
  }

  return await response.json();
}

/**
 * Fetch the names for an array of contributors
 *
 * @param contributors - Array of contributors
 */
async function fetchDetailsContributors(
  contributors: ContributorInfo[],
): Promise<ContributorInfo[]> {
  const detailedContributors: ContributorInfo[] = [];

  for (const contributor of contributors) {
    const details = await fetchDetailsContributor(contributor);

    detailedContributors.push({
      ...contributor,
      name: details.name,
      bio: details.bio,
      location: details.location,
    });
  }

  return detailedContributors;
}

async function fetchContributors() {
  const response = await fetch(CONTRIBUTORS_URL, { headers: HEADERS });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch contributors: ${response.status} ${response.statusText}`,
    );
  }

  const data: GitHubContributorInfo[] = await response.json();

  const contributors: ContributorInfo[] = data
    .filter(
      ({ type, login, contributions }) =>
        type !== 'Bot' && login !== 'electron-bot' && contributions >= 2,
    )
    .map(({ html_url, url, login, avatar_url }) => ({
      url: html_url,
      api: url,
      login: login,
      avatar: avatar_url,
      name: null,
      bio: null,
      location: null,
    }));

  return fetchDetailsContributors(contributors);
}

/**
 * Fetch the contributors and write the result to disk
 */
async function fetchAndWriteContributorsFile() {
  await new Promise<void>((resolve) => {
    fs.access(
      CONTRIBUTORS_FILE_PATH,
      fs.constants.F_OK | fs.constants.R_OK | fs.constants.W_OK,
      async (error) => {
        if (!error) {
          console.log(logSymbols.info, 'Deleting existing contributors file');
          fs.unlinkSync(CONTRIBUTORS_FILE_PATH);
        }

        console.log(logSymbols.info, 'Fetching contributors');
        let data: ContributorInfo[];

        try {
          data = await fetchContributors();

          if (!data || data.length === 0) {
            throw new Error('Contributors array is empty');
          }
        } catch (error) {
          if (process.env.CI) {
            throw error;
          }

          console.warn(`Fetching contributors failed!`, error);
          console.log(`We'll continue without.`);
          data = [];
        }

        await fs.promises.writeFile(
          CONTRIBUTORS_FILE_PATH,
          JSON.stringify(data),
        );

        console.log(logSymbols.success, `${data.length} Contributors fetched`);
        resolve();
      },
    );
  });
}

if (require.main === module) {
  (async () => {
    await maybeFetchContributors();
  })();
}
