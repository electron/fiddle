const { promises: fs } = require('fs');
const path = require('path');

const fetch = require('cross-fetch');

const LINK_RGX = /(http|ftp|https):\/\/([\w_-]+(?:(?:\.[\w_-]+)+))([\w.,@?^=%&:/~+#-]*[\w@?^=%&/~+#-])?/g;

async function retryFetch(link) {
  let retryCount = 2;
  const waitingTime = 1000;

  const execute = async () => {
    const response = await fetch(link, { method: 'HEAD' });

    if (response.ok) {
      return;
    }

    // If we're inside GitHub's release asset server, we just ran into AWS not allowing
    // HEAD requests, which is different from a 404.
    if (response.url.startsWith('https://github-production-release-asset')) {
      return;
    }

    if (retryCount-- === 0) {
      throw new Error(
        `HTTP Error Response: ${response.status} ${response.statusText}`,
      );
    }

    await new Promise((r) => setTimeout(r, waitingTime));

    await execute();
  };

  await execute();
}

async function main() {
  const readmePath = path.join(__dirname, '../README.md');
  const readme = await fs.readFile(readmePath, 'utf-8');
  const links = readme
    .match(LINK_RGX)
    .filter((link) => new URL(link).hostname !== 'img.shields.io'); // img.shields.io gives 403 in CI
  let failed = false;

  for (const link of links) {
    try {
      await retryFetch(link);
      console.log(`✅ ${link}`);
    } catch (error) {
      failed = true;

      console.log(`❌ ${link}\n${error}`);
    }
  }

  if (failed) {
    process.exit(-1);
  }
}

main();
