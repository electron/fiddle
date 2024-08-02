import * as fs from 'node:fs';
import * as path from 'node:path';
import * as util from 'node:util';

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
  name: string;
  bio: string;
  location: string;
}

// Helper function to work around import issues with ESM module
const dynamicImport = new Function('specifier', 'return import(specifier)');

export async function maybeFetchContributors(silent?: boolean): Promise<void> {
  const { default: logSymbols } = await dynamicImport('log-symbols');

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
    if (error.code === 'ENOENT') {
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
function fetchDetailsContributor(contributor: {
  api: string;
}): Promise<ContributorInfo> {
  return fetch(contributor.api, { headers: HEADERS }).then((response) =>
    response.json(),
  );
}

/**
 * Fetch the names for an array of contributors
 *
 * @param contributors - Array of contributor
 */
async function fetchDetailsContributors(
  contributors: Pick<ContributorInfo, 'api'>[],
) {
  const withDetails = contributors as ContributorInfo[];
  const promises: Promise<void>[] = [];

  contributors.forEach((contributor, i) => {
    const detailFetcher = fetchDetailsContributor(contributor).then(
      ({ name, bio, location }) => {
        withDetails[i].name = name;
        withDetails[i].bio = bio;
        withDetails[i].location = location;
      },
    );

    promises.push(detailFetcher);
  });

  await Promise.all(promises);
  return withDetails;
}

function fetchContributors() {
  const contributors: Pick<
    ContributorInfo,
    'url' | 'api' | 'login' | 'avatar'
  >[] = [];

  return fetch(CONTRIBUTORS_URL, { headers: HEADERS })
    .then((response) => response.json())
    .then(async (data: GitHubContributorInfo[]) => {
      if (data && data.forEach) {
        data.forEach(
          ({ html_url, url, login, avatar_url, type, contributions }) => {
            if (
              type !== 'Bot' &&
              login !== 'electron-bot' &&
              contributions >= 2
            ) {
              contributors.push({
                url: html_url,
                api: url,
                login: login,
                avatar: avatar_url,
              });
            }
          },
        );
      }

      return fetchDetailsContributors(contributors);
    });
}

/**
 * Fetch the contributors and write the result to disk
 */
async function fetchAndWriteContributorsFile() {
  const { default: logSymbols } = await dynamicImport('log-symbols');

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
