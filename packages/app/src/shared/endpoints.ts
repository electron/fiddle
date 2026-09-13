/**
 * Every network base URL the app uses, in one injectable object. Read URLs
 * only from `getEndpoints()` (src/main/test-mode.ts), never from literals, so
 * test mode can point all of them at the local fixture server
 * (packages/app/e2e/fixtures/). No Electron imports.
 */
export interface Endpoints {
  /** GitHub REST API, e.g. `${githubApi}/gists/<id>`. */
  githubApi: string;
  /** Raw gist content host, e.g. `${gistRaw}/<owner>/<id>/raw/...`. */
  gistRaw: string;
  /** The full URL of Electron's releases.json. */
  releasesJson: string;
  /** unpkg, e.g. `${unpkg}/electron@<version>/electron.d.ts`. */
  unpkg: string;
  /** Algolia's npm search host, e.g. `${algolia}/1/indexes/npm-search/query`. */
  algolia: string;
  /** npm registry, e.g. `${npmRegistry}/<name>`. */
  npmRegistry: string;
  /** electron/minimal-repro, e.g. `${minimalRepro}/archive/<branch>.zip`. */
  minimalRepro: string;
  /** @electron/get mirror for releases (trailing slash). */
  electronMirror: string;
  /** @electron/get mirror for nightlies (trailing slash). */
  electronNightlyMirror: string;
}

export const DEFAULT_ENDPOINTS: Endpoints = {
  githubApi: 'https://api.github.com',
  gistRaw: 'https://gist.githubusercontent.com',
  releasesJson: 'https://releases.electronjs.org/releases.json',
  unpkg: 'https://unpkg.com',
  algolia: 'https://OFCNCOG2CU-dsn.algolia.net',
  npmRegistry: 'https://registry.npmjs.org',
  minimalRepro: 'https://github.com/electron/minimal-repro',
  electronMirror: 'https://github.com/electron/electron/releases/download/',
  electronNightlyMirror: 'https://github.com/electron/nightlies/releases/download/',
};

/** The same endpoints on the e2e fixture server at `base` (no trailing slash). */
export function fixtureEndpoints(base: string): Endpoints {
  return {
    githubApi: `${base}/github-api`,
    gistRaw: `${base}/gist-raw`,
    releasesJson: `${base}/releases.json`,
    unpkg: `${base}/unpkg`,
    algolia: `${base}/algolia`,
    npmRegistry: `${base}/npm`,
    minimalRepro: `${base}/minimal-repro`,
    electronMirror: `${base}/electron-mirror/`,
    electronNightlyMirror: `${base}/nightly-mirror/`,
  };
}
