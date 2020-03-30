const path = require('path')
const fs = require('fs-extra')
const https = require('https')

const file = path.join(__dirname, '..', 'static', 'releases.json')

function getReleases() {
  return new Promise((resolve) => {
    https.get({
      host: 'registry.npmjs.org',
      path: '/electron',
      headers: {
        'User-Agent': 'Electron Fiddle'
      }
    }, res => {
      res.setEncoding('utf8')
      let body = ''

      res.on('data', data => {
        body += data;
      })

      res.on('end', () => {
        resolve(JSON.parse(body))
      })
    })
  })
}

async function main() {
  const data = await getReleases()
  const releases = Object.keys(data.versions)
    .map((version) => ({ version }))

  console.log(`Updating local releases.json with ${releases.length} versions.`)

  await fs.remove(file)
  await fs.outputFile(file, JSON.stringify(releases))

  console.log('Updating tests with new expected version count.')

  const metadata = {
    expectedVersionCount: releases.length,
    lastElectronVersion: releases[releases.length - 1].version
  }
  const releasesMetadataPath = path.resolve(__dirname, '..', 'tests', 'fixtures', 'releases-metadata.json')
  await fs.writeJson(releasesMetadataPath, metadata, { spaces: 2 })
}

main()
