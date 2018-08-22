const fetch = require('node-fetch');
const fs = require('fs-extra');
const util = require('util');
const path = require('path');
const logSymbols = require('log-symbols');

const CONTRIBUTORS_FILE_PATH = path.join(__dirname, '../static/contributors.json');
const CONTRIBUTORS_URL = 'https://api.github.com/repos/electron/fiddle/contributors'

// 💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖
// 💖                                                     💖
// 💖  If you're a contributor, we'd love to say          💖
// 💖  "thanks" on the app's credits page! Add            💖
// 💖  your GitHub username here to have it included.     💖
// 💖  We'll pull your details automatically from there.  💖
// 💖                                                     💖
// 💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖
const CONTRIBUTORS_WHITELIST = [
  'zeke',
  'charliehess',
  'marshallofsound',
  'felixrieseberg',
  'nctl144',
  'benicheni'
];

async function maybeFetchContributors() {
  try {
    const stats = fs.statSync(CONTRIBUTORS_FILE_PATH);
    const mtime = new Date(util.inspect(stats.mtime));
    const maxAge = new Date(new Date().getTime() - (24 * 60 * 60 * 1000));

    if (mtime < maxAge) {
      // File exists, but is too old
      console.log(logSymbols.warning, 'Contributors file on disk, but older than 24 hours.')
      await fetchAndWriteContributorsFile();
    } else {
      console.log(logSymbols.success, 'Contributors file on disk and recent.')
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File does not exist, move to fetch right away
      await fetchAndWriteContributorsFile();
    } else if (error) {
      throw error;
    };
  };
}

/**
 * Helpers
 */

/**
 * Fetch the name for a contributor
 *
 * @param contributor - Contributor object
 * @returns {Promise}
 */
function fetchDetailsContributor(contributor) {
  return fetch(contributor.api)
    .then((response) => response.json());
}

/**
 * Fetch the names for an array of contributors
 *
 * @param contributors - Array of contributor
 * @returns {Promise}
 */
function fetchDetailsContributors(contributors) {
  return new Promise((resolve) => {
    const withDetails = contributors;
    const promises = [];

    contributors.forEach((contributor, i) => {
      const detailFetcher = fetchDetailsContributor(contributor)
        .then(({ name, bio, location }) => {
          withDetails[i].name = name;
          withDetails[i].bio = bio;
          withDetails[i].location = location;
        });

      promises.push(detailFetcher);
    });

    Promise.all(promises).then(() => resolve(withDetails));
  });
}

/**
 * (description)
 *
 * @export
 * @returns {Promise}
 */
function fetchContributors() {
  const contributors = [];

  return fetch(CONTRIBUTORS_URL)
    .then((response) => response.json())
    .then(async (data) => {
      if (data && data.forEach) {
        data.forEach(({ html_url, url, login, avatar_url }) => {
          if (CONTRIBUTORS_WHITELIST.find((name) => name.toLowerCase() === login.toLowerCase())) {
            contributors.push({
              url: html_url,
              api: url,
              login: login,
              avatar: avatar_url
            });
          }
        });
      }

      return fetchDetailsContributors(contributors);
    });
}

/**
 * Fetch the contributors and write the result to disk
 */
async function fetchAndWriteContributorsFile() {
  await new Promise((resolve) => {
    fs.access(CONTRIBUTORS_FILE_PATH, fs.constants.F_OK | fs.constants.R_OK | fs.constants.W_OK, async (error) => {
      if (!error) {
        console.log(logSymbols.info, 'Deleting existing contributors file');
        fs.unlinkSync(CONTRIBUTORS_FILE_PATH);
      }

      console.log(logSymbols.info, 'Fetching contributors');
      let data;

      try {
        data = await fetchContributors()
      } catch (error) {
        console.warn(`Fetching contributors failed!`, error);
        console.log(`We'll continue without.`);
        data = [];
      }

      await fs.outputFile(CONTRIBUTORS_FILE_PATH, JSON.stringify(data));

      console.log(logSymbols.success, 'Contributors fetched');
      resolve();
    });
  });
}

module.exports = {
  maybeFetchContributors
}

if (require.main === module) maybeFetchContributors();
