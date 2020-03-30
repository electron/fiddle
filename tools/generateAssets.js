/* tslint:disable */

const { maybeFetchContributors } = require('./contributors')
const { compileParcel } = require('./parcel-build')

module.exports = async () => {
  await Promise.all([maybeFetchContributors(), compileParcel()])
}
