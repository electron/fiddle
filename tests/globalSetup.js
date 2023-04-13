const { maybeFetchContributors } = require('../tools/contributors');
const { populateReleases } = require('../tools/fetch-releases');

async function globalSetup() {
  await Promise.all([maybeFetchContributors(true), populateReleases()]);
}

module.exports = globalSetup;
