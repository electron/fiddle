import { mkdtemp, readdir, readFile, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ErrorCode } from '../shared/errors';
import {
  createTemplateLoader,
  isMissingTemplate,
  MISSING_TEMPLATE_TTL_MS,
  readQuickStart,
  templateBranch,
} from './templates';

const staticDir = fileURLToPath(new URL('../../static', import.meta.url));
// A real zip: `minimal-repro-fixture/` holding main.js, index.html, README.md, package.json and sub/nested.js.
const fixture = fileURLToPath(
  new URL('./test-fixtures/minimal-repro.zip', import.meta.url),
);
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
    return status === 200
      ? new Response(new Uint8Array(await readFile(fixture)))
      : new Response('nope', { status });
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
    expect(Object.keys(files).sort()).toEqual([
      'index.html',
      'main.js',
      'preload.js',
      'renderer.js',
    ]);
    expect(files['main.js']).toContain('BrowserWindow');
  });
});

describe('createTemplateLoader', () => {
  it('downloads, extracts and caches the archive root', async () => {
    const { fn, urls } = zipFetch();
    const loader = createTemplateLoader({
      staticDir,
      cacheDir,
      isReleasedMajor: released,
      fetch: fn,
    });
    const files = await loader.getTemplate('30.1.0');
    expect(files).toEqual(FIXTURE_FILES);
    expect(urls).toEqual([
      'https://github.com/electron/minimal-repro/archive/30-x-y.zip',
    ]);
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
    const again = createTemplateLoader({
      staticDir,
      cacheDir,
      isReleasedMajor: released,
      fetch: second.fn,
    });
    expect(await again.getTemplate('30.0.0')).toEqual(FIXTURE_FILES);
    expect(second.urls).toHaveLength(0);
  });

  it('shares one download between concurrent callers', async () => {
    const { fn, urls } = zipFetch();
    const loader = createTemplateLoader({
      staticDir,
      cacheDir,
      isReleasedMajor: released,
      fetch: fn,
    });
    await Promise.all([loader.getTemplate('29.0.0'), loader.getTemplate('29.1.0')]);
    expect(urls).toHaveLength(1);
  });

  it('loads the test template from its branch', async () => {
    const { fn, urls } = zipFetch();
    const loader = createTemplateLoader({
      staticDir,
      cacheDir,
      isReleasedMajor: released,
      fetch: fn,
    });
    expect(await loader.getTestTemplate()).toEqual(FIXTURE_FILES);
    expect(urls).toEqual([
      'https://github.com/electron/minimal-repro/archive/test-template.zip',
    ]);
  });

  it('uses the bundled template for unreleased majors and local builds', async () => {
    const { fn, urls } = zipFetch();
    const loader = createTemplateLoader({
      staticDir,
      cacheDir,
      isReleasedMajor: released,
      fetch: fn,
    });
    const quickStart = await readQuickStart(staticDir);
    expect(await loader.getTemplate('99.0.0-nightly.20300101')).toEqual(quickStart);
    expect(await loader.getTemplate()).toEqual(quickStart);
    expect(urls).toHaveLength(0);
  });

  it('falls back on failed downloads and retries later', async () => {
    const { fn, urls } = zipFetch(500);
    const fallbacks: string[] = [];
    const errors: unknown[] = [];
    const loader = createTemplateLoader({
      staticDir,
      cacheDir,
      isReleasedMajor: released,
      fetch: fn,
      onFallback: (branch, error) => {
        fallbacks.push(branch);
        errors.push(error);
      },
    });
    const quickStart = await readQuickStart(staticDir);
    expect(await loader.getTemplate('30.0.0')).toEqual(quickStart);
    expect(await loader.getTemplate('30.0.0')).toEqual(quickStart);
    expect(urls).toHaveLength(2);
    expect(fallbacks).toEqual(['30-x-y', '30-x-y']);
    expect(errors[0]).toMatchObject({
      code: ErrorCode.network,
      details: { status: 500 },
    });
    expect(isMissingTemplate(errors[0])).toBe(false);
    // A failed download leaves no marker behind.
    expect(await readdir(cacheDir)).toEqual([]);
  });

  it('remembers a major without a minimal-repro branch, in memory and on disk for a day', async () => {
    const quickStart = await readQuickStart(staticDir);
    const { fn, urls } = zipFetch(404);
    const errors: unknown[] = [];
    const loader = createTemplateLoader({
      staticDir,
      cacheDir,
      isReleasedMajor: released,
      fetch: fn,
      onFallback: (_branch, error) => errors.push(error),
    });
    expect(await loader.getTemplate('30.0.0')).toEqual(quickStart);
    expect(urls).toEqual([
      'https://github.com/electron/minimal-repro/archive/30-x-y.zip',
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      code: ErrorCode.notFound,
      details: { status: 404 },
    });
    expect(isMissingTemplate(errors[0])).toBe(true);
    expect(await readdir(cacheDir)).toEqual(['minimal-repro-30-x-y.missing']);

    // The same process doesn't ask again, and reports the fallback once.
    expect(await loader.getTemplate('30.1.0')).toEqual(quickStart);
    expect(urls).toHaveLength(1);
    expect(errors).toHaveLength(1);

    // Nor does the next launch, while the marker is fresh.
    const next = zipFetch(404);
    const onFallback = (_branch: string, error: unknown) => errors.push(error);
    const relaunched = createTemplateLoader({
      staticDir,
      cacheDir,
      isReleasedMajor: released,
      fetch: next.fn,
      onFallback,
    });
    expect(await relaunched.getTemplate('30.0.0')).toEqual(quickStart);
    expect(next.urls).toHaveLength(0);
    expect(errors).toHaveLength(2);
    expect(isMissingTemplate(errors[1])).toBe(true);

    // A day later the branch is requested again, and used once it exists.
    const dayAgo = new Date(Date.now() - MISSING_TEMPLATE_TTL_MS - 1000);
    await utimes(path.join(cacheDir, 'minimal-repro-30-x-y.missing'), dayAgo, dayAgo);
    const later = zipFetch();
    const nextDay = createTemplateLoader({
      staticDir,
      cacheDir,
      isReleasedMajor: released,
      fetch: later.fn,
    });
    expect(await nextDay.getTemplate('30.0.0')).toEqual(FIXTURE_FILES);
    expect(later.urls).toEqual([
      'https://github.com/electron/minimal-repro/archive/30-x-y.zip',
    ]);
    expect((await readdir(cacheDir)).sort()).toEqual([
      'minimal-repro-30-x-y',
      'minimal-repro-30-x-y.missing',
    ]);
  });

  it('refreshes an expired marker when the branch is still missing', async () => {
    const quickStart = await readQuickStart(staticDir);
    const first = zipFetch(404);
    await createTemplateLoader({
      staticDir,
      cacheDir,
      isReleasedMajor: released,
      fetch: first.fn,
    }).getTemplate('30.0.0');
    const marker = path.join(cacheDir, 'minimal-repro-30-x-y.missing');
    const dayAgo = new Date(Date.now() - MISSING_TEMPLATE_TTL_MS - 1000);
    await utimes(marker, dayAgo, dayAgo);

    const second = zipFetch(404);
    const expired = createTemplateLoader({
      staticDir,
      cacheDir,
      isReleasedMajor: released,
      fetch: second.fn,
    });
    expect(await expired.getTemplate('30.0.0')).toEqual(quickStart);
    expect(second.urls).toHaveLength(1);
    const third = zipFetch(404);
    await createTemplateLoader({
      staticDir,
      cacheDir,
      isReleasedMajor: released,
      fetch: third.fn,
    }).getTemplate('30.0.0');
    expect(third.urls).toHaveLength(0);
  });

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

  it('returns the bundled template after waitMs while the download goes on', async () => {
    const quickStart = await readQuickStart(staticDir);
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { fn, urls } = zipFetch();
    const slow = (async (input: string | URL | Request, init?: RequestInit) => {
      await gate;
      return fn(input, init);
    }) as typeof fetch;
    const loader = createTemplateLoader({
      staticDir,
      cacheDir,
      isReleasedMajor: released,
      fetch: slow,
      waitMs: 60_000,
    });

    // A call's own waitMs overrides the loader's.
    expect(await loader.getTemplate('30.0.0', 20)).toEqual(quickStart);
    release!();
    // The same download finishes in the background: a later call gets the real template.
    await expect.poll(() => loader.getTemplate('30.0.0')).toEqual(FIXTURE_FILES);
    expect(urls).toHaveLength(1);
  });

  it('times out, and can be aborted', async () => {
    const quickStart = await readQuickStart(staticDir);
    const errors: unknown[] = [];
    const onFallback = (_branch: string, error: unknown) => errors.push(error);

    const slow = createTemplateLoader({
      staticDir,
      cacheDir,
      isReleasedMajor: released,
      fetch: hangingFetch,
      timeoutMs: 20,
      onFallback,
    });
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
