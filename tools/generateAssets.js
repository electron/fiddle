/* tslint:disable */

const { maybeFetchContributors } = require('./fetch-contributors');
const { generateTypeScript } = require('./tsc');

module.exports = async () => {
  await maybeFetchContributors();
  await generateTypeScript();
}
