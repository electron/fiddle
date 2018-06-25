/* tslint:disable */

const { maybeFetchContributors } = require('./contributors');
const { compileTypeScript } = require('./tsc');
const { compileLess } = require('./lessc');

module.exports = async () => {
  await Promise.all([maybeFetchContributors(), compileTypeScript(), compileLess()]);
}
