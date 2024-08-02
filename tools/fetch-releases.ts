import * as fs from 'node:fs';
import * as path from 'node:path';

import { ElectronVersions } from '@electron/fiddle-core';

const file = path.join(__dirname, '..', 'static', 'releases.json');

export async function populateReleases() {
  const elves = await ElectronVersions.create(undefined, { ignoreCache: true });
  const releases = elves.versions.map(({ version }) =>
    elves.getReleaseInfo(version),
  );

  if (releases.length) {
    console.log(
      `Updating local releases.json with ${releases.length} versions.`,
    );

    await fs.promises.writeFile(file, JSON.stringify(releases));
  } else if (process.env.CI) {
    throw new Error('Failed to fetch latest releases.json');
  } else {
    console.warn(
      'Failed to fetch latest releases.json, falling back to whatever exists on disk',
    );
  }
}

if (require.main === module) {
  (async () => {
    await populateReleases();
  })();
}
