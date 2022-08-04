const path = require('path');

const fs = require('fs-extra');

const CONTRIBUTORS_FILE_PATH = path.join(
  __dirname,
  '../static/contributors.json',
);

async function maybePopulateEmptyContributors() {
  try {
    await fs.readJson(CONTRIBUTORS_FILE_PATH);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File does not exist, create an empty JSON file instead
      await populateEmptyContributors();
    } else if (error) {
      throw error;
    }
  }
}

/**
 * Creates an empty JSON file at CONTRIBUTORS_FILE_PATH location
 */
async function populateEmptyContributors() {
  await fs.outputFile(CONTRIBUTORS_FILE_PATH, JSON.stringify([]));
}

module.exports = maybePopulateEmptyContributors;
