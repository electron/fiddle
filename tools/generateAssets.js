const { maybeFetchContributors } = require('./contributors');

module.exports = async () => {
  await Promise.all([maybeFetchContributors()]);
};
