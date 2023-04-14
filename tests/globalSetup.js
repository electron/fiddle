const { maybeFetchContributors } = require('../tools/contributors');

async function globalSetup() {
  await maybeFetchContributors(true);
}

module.exports = globalSetup;
