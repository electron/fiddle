const path = require('path')
const fs = require('fs-extra')
const https = require('https')

const url = '/repos/electron/electron/releases'
const file = path.join(__dirname, '..', 'static', 'releases.json')

function getReleases() {
  return new Promise((resolve) => {
    https.get({
      host: 'api.github.com',
      path: url,
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
  const releases = data
    .map((release) => ({
      url: release.url,
      assets_url: release.assets_url,
      html_url: release.html_url,
      tag_name: release.tag_name,
      target_commitish: release.target_commitish,
      name: release.name,
      prerelease: release.prerelease,
      created_at: release.created_at,
      published_at: release.published_at,
      body: release.body
    }))
    .filter((release) => !release.tag_name.includes('unsupported'))

  await fs.remove(file)
  await fs.outputFile(file, JSON.stringify(releases, undefined, 2))
}

main()
