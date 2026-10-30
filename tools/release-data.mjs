#!/usr/bin/env node
// Refreshes packages/app/static/releases.json (releases.electronjs.org) and
// contributors.json (GitHub API); refresh-data.yml commits them through a PR.
// Plain Node, no dependencies, so the workflow needs no install. GITHUB_TOKEN
// (or GH_TOKEN) raises the GitHub API rate limit.
import fs from 'node:fs/promises';
import path from 'node:path';

const staticDir = path.resolve(import.meta.dirname, '..', 'packages', 'app', 'static');
const RELEASES_URL = 'https://releases.electronjs.org/releases.json';
const CONTRIBUTORS_URL = 'https://api.github.com/repos/electron/fiddle/contributors';

async function getJson(url, headers = {}) {
  const response = await globalThis.fetch(url, {
    headers: { 'User-Agent': 'electron-fiddle-refresh-data', ...headers },
  });
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
  return response.json();
}

async function refreshReleases() {
  const releases = await getJson(RELEASES_URL);
  if (!Array.isArray(releases) || releases.length === 0) {
    throw new Error(`${RELEASES_URL} returned no releases`);
  }
  await fs.writeFile(path.join(staticDir, 'releases.json'), JSON.stringify(releases));
  console.log(`releases.json: ${releases.length} releases`);
}

async function refreshContributors() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const headers = {
    Accept: 'application/vnd.github+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const all = [];
  for (let page = 1; ; page++) {
    const batch = await getJson(`${CONTRIBUTORS_URL}?per_page=100&page=${page}`, headers);
    all.push(...batch);
    if (batch.length < 100) break;
  }
  const contributors = all
    .filter((contributor) => contributor.type === 'User')
    .map(({ login, html_url, contributions }) => ({
      login,
      url: html_url,
      contributions,
    }));
  if (contributors.length === 0)
    throw new Error(`${CONTRIBUTORS_URL} returned no contributors`);
  const data = {
    schemaVersion: 1,
    source: CONTRIBUTORS_URL,
    fetchedAt: new Date().toISOString().slice(0, 10),
    contributors,
  };
  await fs.writeFile(
    path.join(staticDir, 'contributors.json'),
    `${JSON.stringify(data, null, 2)}\n`,
  );
  console.log(`contributors.json: ${contributors.length} contributors`);
}

// Refresh both, then fail if either failed, so one outage doesn't block the other.
const results = await Promise.allSettled([refreshReleases(), refreshContributors()]);
for (const result of results) {
  if (result.status === 'rejected') console.error(result.reason);
}
process.exit(results.some((result) => result.status === 'rejected') ? 1 : 0);
