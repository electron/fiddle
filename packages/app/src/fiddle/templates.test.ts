import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTemplateLoader, readQuickStart, templateBranch } from './templates';
import { makeZip } from './test-helpers/zip';

const staticDir = fileURLToPath(new URL('../../static', import.meta.url));
const released = (major: number) => major >= 1 && major <= 40;

let cacheDir: string;
beforeEach(async () => {
  cacheDir = await mkdtemp(path.join(tmpdir(), 'fiddle-templates-'));
});
afterEach(async () => {
  await rm(cacheDir, { recursive: true, force: true });
});

function archive(branch: string): Buffer {
  const root = `minimal-repro-${branch}`;
  return makeZip({
    [`${root}/`]: '',
    [`${root}/main.js`]: `// ${branch} main`,
    [`${root}/index.html`]: '<h1>hi</h1>',
    [`${root}/README.md`]: '# readme',
    [`${root}/package.json`]: '{}',
    [`${root}/sub/nested.js`]: 'nested',
    'stray.js': 'outside the root folder',
  });
}

function zipFetch(status = 200) {
  const urls: string[] = [];
  const fn = (async (input: string | URL | Request) => {
    const url = String(input);
    urls.push(url);
    const branch = /archive\/(.+)\.zip$/.exec(url)?.[1] ?? '';
    return status === 200 ? new Response(new Uint8Array(archive(branch))) : new Response('nope', { status });
  }) as typeof fetch;
  return { fn, urls };
}

describe('templateBranch', () => {
  it('maps released versions to their x-y branch', () => {
    expect(templateBranch('30.1.0', released)).toBe('30-x-y');
    expect(templateBranch('31.0.0-beta.2', released)).toBe('31-x-y');
    expect(templateBranch('99.0.0', released)).toBeNull();
    expect(templateBranch('0.37.8', () => true)).toBeNull();
    expect(templateBranch('not-a-version', released)).toBeNull();
  });
});

describe('quick-start', () => {
  it('reads the bundled template', async () => {
    const files = await readQuickStart(staticDir);
    expect(Object.keys(files).sort()).toEqual(['index.html', 'main.js', 'preload.js', 'renderer.js']);
    expect(files['main.js']).toContain('BrowserWindow');
  });
});

describe('createTemplateLoader', () => {
  it('downloads, extracts top-level supported files and caches them', async () => {
    const { fn, urls } = zipFetch();
    const loader = createTemplateLoader({ staticDir, cacheDir, isReleasedMajor: released, fetch: fn });
    const files = await loader.getTemplate('30.1.0');
    expect(files).toEqual({ 'main.js': '// 30-x-y main', 'index.html': '<h1>hi</h1>' });
    expect(urls).toEqual(['https://github.com/electron/minimal-repro/archive/30-x-y.zip']);
    expect((await readdir(path.join(cacheDir, 'minimal-repro-30-x-y'))).sort()).toEqual(['index.html', 'main.js']);

    // Cached in memory, and returns a fresh copy each time.
    files['main.js'] = 'mutated';
    expect((await loader.getTemplate('30.2.0'))['main.js']).toBe('// 30-x-y main');
    expect(urls).toHaveLength(1);

    // Cached on disk for a new loader.
    const second = zipFetch();
    const again = createTemplateLoader({ staticDir, cacheDir, isReleasedMajor: released, fetch: second.fn });
    expect(await again.getTemplate('30.0.0')).toEqual({ 'main.js': '// 30-x-y main', 'index.html': '<h1>hi</h1>' });
    expect(second.urls).toHaveLength(0);
  });

  it('shares one download between concurrent callers', async () => {
    const { fn, urls } = zipFetch();
    const loader = createTemplateLoader({ staticDir, cacheDir, isReleasedMajor: released, fetch: fn });
    await Promise.all([loader.getTemplate('29.0.0'), loader.getTemplate('29.1.0')]);
    expect(urls).toHaveLength(1);
  });

  it('loads the test template from its branch', async () => {
    const { fn, urls } = zipFetch();
    const loader = createTemplateLoader({ staticDir, cacheDir, isReleasedMajor: released, fetch: fn });
    expect((await loader.getTestTemplate())['main.js']).toBe('// test-template main');
    expect(urls).toEqual(['https://github.com/electron/minimal-repro/archive/test-template.zip']);
  });

  it('uses the bundled template for unreleased majors and local builds', async () => {
    const { fn, urls } = zipFetch();
    const loader = createTemplateLoader({ staticDir, cacheDir, isReleasedMajor: released, fetch: fn });
    const quickStart = await readQuickStart(staticDir);
    expect(await loader.getTemplate('99.0.0-nightly.20300101')).toEqual(quickStart);
    expect(await loader.getTemplate()).toEqual(quickStart);
    expect(urls).toHaveLength(0);
  });

  it('falls back on failed downloads and retries later', async () => {
    const { fn, urls } = zipFetch(404);
    const fallbacks: string[] = [];
    const loader = createTemplateLoader({
      staticDir,
      cacheDir,
      isReleasedMajor: released,
      fetch: fn,
      onFallback: (branch) => fallbacks.push(branch),
    });
    const quickStart = await readQuickStart(staticDir);
    expect(await loader.getTemplate('30.0.0')).toEqual(quickStart);
    expect(await loader.getTemplate('30.0.0')).toEqual(quickStart);
    expect(urls).toHaveLength(2);
    expect(fallbacks).toEqual(['30-x-y', '30-x-y']);
    expect(await readdir(cacheDir)).toEqual([]);
  });

  it('falls back when offline or the archive is corrupt', async () => {
    const offline = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    const corrupt = (async () => new Response('garbage')) as typeof fetch;
    const quickStart = await readQuickStart(staticDir);
    for (const fn of [offline, corrupt]) {
      const loader = createTemplateLoader({ staticDir, cacheDir, isReleasedMajor: released, fetch: fn });
      expect(await loader.getTemplate('30.0.0')).toEqual(quickStart);
    }
    expect(await readdir(cacheDir)).toEqual([]);
  });
});
