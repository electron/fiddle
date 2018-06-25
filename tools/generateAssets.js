/* tslint:disable */

const { maybeFetchContributors } = require('./contributors');
const { compileTypeScript } = require('./tsc');
const { compileLess } = require('./lessc');

await Promise.all([maybeFetchContributors(), compileTypescript(), compileLess()]);
