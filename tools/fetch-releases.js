const path = require('path');

const { ElectronVersions } = require('@electron/fiddle-core');
const fs = require('fs-extra');

const file = path.join(__dirname, '..', 'static', 'releases.json');

async function populateReleases() {
  const elves = await ElectronVersions.create(undefined, { ignoreCache: true });
  const releases = elves.versions.map(({ version }) =>
    elves.getReleaseInfo(version),
  );

  if (releases.length) {
    console.log(
      `Updating local releases.json with ${releases.length} versions.`,
    );

    await fs.outputJSON(file, releases);
  } else if (process.env.CI) {
    throw new Error('Failed to fetch latest releases.json');
  } else {
    console.warn(
      'Failed to fetch latest releases.json, falling back to whatever exists on disk',
    );
  }
}

module.exports = {
  populateReleases,
};

if (require.main === module) {
  (async () => {
    await populateReleases();
  })();
}
