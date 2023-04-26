const path = require('path');

const { ElectronVersions } = require('@electron/fiddle-core');
const fs = require('fs-extra');

const file = path.join(__dirname, '..', 'static', 'releases.json');

async function populateReleases() {
  const elves = await ElectronVersions.create(undefined, { ignoreCache: true });
  const releases = elves.versions.map(({ version }) =>
    elves.getReleaseInfo(version),
  );

  console.log(`Updating local releases.json with ${releases.length} versions.`);

  await fs.remove(file);
  await fs.outputJSON(file, releases);
}

module.exports = {
  populateReleases,
};

if (require.main === module) {
  (async () => {
    await populateReleases();
  })();
}
