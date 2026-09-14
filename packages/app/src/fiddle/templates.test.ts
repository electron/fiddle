import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ErrorCode } from '../shared/errors';
import { createTemplateLoader, readQuickStart, templateBranch } from './templates';

const staticDir = fileURLToPath(new URL('../../static', import.meta.url));
// A real zip: `minimal-repro-fixture/` holding main.js, index.html, README.md, package.json and sub/nested.js.
const fixture = fileURLToPath(new URL('./test-fixtures/minimal-repro.zip', import.meta.url));
const FIXTURE_FILES = { 'main.js': '// fixture main', 'index.html': '<h1>hi</h1>' };
const released = (major: number) => major >= 1 && major <= 40;

let cacheDir: string;
beforeEach(async () => {
  cacheDir = await mkdtemp(path.join(tmpdir(), 'fiddle-templates-'));
});
afterEach(async () => {
  await rm(cacheDir, { recursive: true, force: true });
});

function zipFetch(status = 200) {
  const urls: string[] = [];
  const fn = (async (input: string | URL | Request) => {
    urls.push(String(input));
    return status === 200 ? new Response(new Uint8Array(await readFile(fixture))) : new Response('nope', { status });
  }) as typeof fetch;
  return { fn, urls };
}

/** A fetch that never answers, and rejects when its signal aborts. */
const hangingFetch = ((_input: string | URL | Request, init?: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    const signal = init!.signal!;
    if (signal.aborted) reject(signal.reason);
    signal.addEventListener('abort', () => reject(signal.reason));
  })) as typeof fetch;

describe('templateBranch', () => {
  // @feature load.template-download
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
  // @feature load.template-download
  it('downloads, extracts and caches the archive root', async () => {
    const { fn, urls } = zipFetch();
    const loader = createTemplateLoader({ staticDir, cacheDir, isReleasedMajor: released, fetch: fn });
    const files = await loader.getTemplate('30.1.0');
    expect(files).toEqual(FIXTURE_FILES);
    expect(urls).toEqual(['https://github.com/electron/minimal-repro/archive/30-x-y.zip']);
    // The temp files are gone; the extracted root was renamed into place.
    expect(await readdir(cacheDir)).toEqual(['minimal-repro-30-x-y']);
    expect((await readdir(path.join(cacheDir, 'minimal-repro-30-x-y'))).sort()).toEqual([
      'README.md',
      'index.html',
      'main.js',
      'package.json',
      'sub',
    ]);

    // Cached in memory, and returns a fresh copy each time.
    files['main.js'] = 'mutated';
    expect((await loader.getTemplate('30.2.0'))['main.js']).toBe('// fixture main');
    expect(urls).toHaveLength(1);

    // Cached on disk for a new loader.
    const second = zipFetch();
    const again = createTemplateLoader({ staticDir, cacheDir, isReleasedMajor: released, fetch: second.fn });
    expect(await again.getTemplate('30.0.0')).toEqual(FIXTURE_FILES);
    expect(second.urls).toHaveLength(0);
  });

  it('shares one download between concurrent callers', async () => {
    const { fn, urls } = zipFetch();
    const loader = createTemplateLoader({ staticDir, cacheDir, isReleasedMajor: released, fetch: fn });
    await Promise.all([loader.getTemplate('29.0.0'), loader.getTemplate('29.1.0')]);
    expect(urls).toHaveLength(1);
  });

  // @feature load.new-test
  it('loads the test template from its branch', async () => {
    const { fn, urls } = zipFetch();
    const loader = createTemplateLoader({ staticDir, cacheDir, isReleasedMajor: released, fetch: fn });
    expect(await loader.getTestTemplate()).toEqual(FIXTURE_FILES);
    expect(urls).toEqual(['https://github.com/electron/minimal-repro/archive/test-template.zip']);
  });

  // @feature load.template-fallback
  it('uses the bundled template for unreleased majors and local builds', async () => {
    const { fn, urls } = zipFetch();
    const loader = createTemplateLoader({ staticDir, cacheDir, isReleasedMajor: released, fetch: fn });
    const quickStart = await readQuickStart(staticDir);
    expect(await loader.getTemplate('99.0.0-nightly.20300101')).toEqual(quickStart);
    expect(await loader.getTemplate()).toEqual(quickStart);
    expect(urls).toHaveLength(0);
  });

  // @feature load.template-fallback
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

  // @feature load.template-fallback
  it('falls back when offline or the archive is corrupt, leaving nothing behind', async () => {
    const offline = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    const corrupt = (async () => new Response('garbage')) as typeof fetch;
    const quickStart = await readQuickStart(staticDir);
    for (const fn of [offline, corrupt]) {
      const errors: unknown[] = [];
      const loader = createTemplateLoader({
        staticDir,
        cacheDir,
        isReleasedMajor: released,
        fetch: fn,
        onFallback: (_branch, error) => errors.push(error),
      });
      expect(await loader.getTemplate('30.0.0')).toEqual(quickStart);
      expect(errors).toHaveLength(1);
    }
    expect(await readdir(cacheDir)).toEqual([]);
  });

  it('times out, and can be aborted', async () => {
    const quickStart = await readQuickStart(staticDir);
    const errors: unknown[] = [];
    const onFallback = (_branch: string, error: unknown) => errors.push(error);

    const slow = createTemplateLoader({ staticDir, cacheDir, isReleasedMajor: released, fetch: hangingFetch, timeoutMs: 20, onFallback });
    expect(await slow.getTemplate('30.0.0')).toEqual(quickStart);
    expect(errors[0]).toMatchObject({ code: ErrorCode.network });

    const controller = new AbortController();
    const aborted = createTemplateLoader({
      staticDir,
      cacheDir,
      isReleasedMajor: released,
      fetch: hangingFetch,
      signal: controller.signal,
      onFallback,
    });
    const pending = aborted.getTemplate('31.0.0');
    controller.abort();
    expect(await pending).toEqual(quickStart);
    expect(errors[1]).toMatchObject({ code: ErrorCode.cancelled });
  });
});
