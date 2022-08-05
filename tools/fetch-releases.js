const path = require('path');

const fetch = require('cross-fetch');
const fs = require('fs-extra');

const file = path.join(__dirname, '..', 'static', 'releases.json');

async function getReleases() {
  const url = 'https://releases.electronjs.org/releases.json';
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Electron Fiddle',
    },
  });
  return await response.json();
}

async function main() {
  const data = await getReleases();
  const releases = data.map(({ version, node }) => ({ version, node }));

  console.log(`Updating local releases.json with ${releases.length} versions.`);

  await fs.remove(file);
  await fs.outputFile(file, JSON.stringify(releases));

  console.log('Updating tests with new expected version count.');
}

main();
