const path = require('path');
const fs = require('fs-extra');
const fetch = require('node-fetch');

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
  const releases = data.map(({ version }) => ({ version }));

  console.log(`Updating local releases.json with ${releases.length} versions.`);

  await fs.remove(file);
  await fs.outputFile(file, JSON.stringify(releases));

  console.log('Updating tests with new expected version count.');

  const metadata = {
    expectedVersionCount: releases.length,
  };
  const releasesMetadataPath = path.resolve(
    __dirname,
    '..',
    'tests',
    'fixtures',
    'releases-metadata.json',
  );
  await fs.writeJson(releasesMetadataPath, metadata, { spaces: 2 });
}

main();
