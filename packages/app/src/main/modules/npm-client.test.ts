import { describe, expect, it, vi } from 'vitest';

import { FiddleError } from '../../shared/errors';
import { NpmClient, rankSearchHits, toVersionList, type FetchFn } from './npm-client';

const hit = (name: string, version = '1.0.0', description = '') => ({
  name,
  version,
  description,
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('rankSearchHits', () => {
  it('moves an exact name match to the top', () => {
    const ranked = rankSearchHits('react', [
      hit('react-dom'),
      hit('preact'),
      hit('react'),
      hit('react-is'),
    ]);
    expect(ranked.map((r) => r.name)).toEqual([
      'react',
      'react-dom',
      'preact',
      'react-is',
    ]);
  });

  it('matches names case-insensitively and ignores surrounding space', () => {
    const ranked = rankSearchHits('  jsonstream ', [
      hit('json-stream'),
      hit('JSONStream'),
    ]);
    expect(ranked[0]?.name).toBe('JSONStream');
  });

  it('keeps Algolia order when nothing matches exactly', () => {
    const ranked = rankSearchHits('lod', [hit('lodash'), hit('lodash.merge')]);
    expect(ranked.map((r) => r.name)).toEqual(['lodash', 'lodash.merge']);
  });

  it('returns at most five results, drops malformed and duplicate hits', () => {
    const hits = [
      { name: 1, version: '1.0.0' },
      hit('a'),
      hit('a'),
      { name: 'no-version' },
      hit('b'),
      hit('c'),
      hit('d'),
      hit('e'),
      hit('f'),
    ];
    expect(rankSearchHits('x', hits).map((r) => r.name)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
  });

  it('keeps an exact match that Algolia ranked past the limit', () => {
    const hits = ['a', 'b', 'c', 'd', 'e', 'f', 'wanted'].map((n) => hit(n));
    const ranked = rankSearchHits('wanted', hits);
    expect(ranked[0]?.name).toBe('wanted');
    expect(ranked).toHaveLength(5);
  });
});

describe('toVersionList', () => {
  it('sorts newest first and uses the latest dist-tag', () => {
    expect(toVersionList(['1.0.0', '2.0.0-beta.1', '1.2.0'], '1.2.0')).toEqual({
      latest: '1.2.0',
      versions: ['2.0.0-beta.1', '1.2.0', '1.0.0'],
    });
  });

  it('falls back to the newest stable version without a usable tag', () => {
    expect(toVersionList(['1.0.0', '3.0.0-rc.1', '2.1.0'], undefined).latest).toBe(
      '2.1.0',
    );
    expect(toVersionList(['1.0.0'], 'not-published').latest).toBe('1.0.0');
  });

  it('drops invalid versions and handles empty lists', () => {
    expect(toVersionList(['nope', '1.0.0'], undefined).versions).toEqual(['1.0.0']);
    expect(toVersionList([], undefined)).toEqual({ latest: null, versions: [] });
  });
});

describe('NpmClient', () => {
  const endpoints = {
    searchUrl: 'http://fixture.test/search',
    registryUrl: 'http://fixture.test/npm',
  };

  it('queries the search endpoint and caches by query', async () => {
    const fetch = vi.fn<FetchFn>(async () =>
      json({ hits: [hit('lodash-es'), hit('lodash')] }),
    );
    const client = new NpmClient({ fetch, endpoints });

    const results = await client.search('lodash');
    expect(results.map((r) => r.name)).toEqual(['lodash', 'lodash-es']);
    await client.search(' lodash ');
    expect(fetch).toHaveBeenCalledTimes(1);

    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(endpoints.searchUrl);
    expect(JSON.parse(String(init?.body))).toMatchObject({
      query: 'lodash',
      hitsPerPage: 5,
      optionalFilters: ['objectID:lodash'],
    });
  });

  it('returns no results for an empty query without fetching', async () => {
    const fetch = vi.fn<FetchFn>();
    expect(await new NpmClient({ fetch, endpoints }).search('   ')).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('lists versions from the registry, escaping scoped names', async () => {
    const fetch = vi.fn<FetchFn>(async () =>
      json({
        'dist-tags': { latest: '2.0.0' },
        versions: { '1.0.0': {}, '2.0.0': {}, '3.0.0-next.0': {} },
      }),
    );
    const client = new NpmClient({ fetch, endpoints });
    expect(await client.versions('@scope/pkg')).toEqual({
      latest: '2.0.0',
      versions: ['3.0.0-next.0', '2.0.0', '1.0.0'],
    });
    expect(fetch.mock.calls[0]?.[0]).toBe('http://fixture.test/npm/@scope%2Fpkg');
    expect(await client.latestVersion('@scope/pkg')).toBe('2.0.0');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('reads registry metadata for a package without caching it', async () => {
    const fetch = vi.fn<FetchFn>(async () =>
      json({ versions: { '1.0.0': { hasInstallScript: true } } }),
    );
    const client = new NpmClient({ fetch, endpoints });
    const controller = new AbortController();
    expect(await client.packument('@scope/pkg', controller.signal)).toEqual({
      versions: { '1.0.0': { hasInstallScript: true } },
    });
    await client.packument('@scope/pkg');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0]?.[0]).toBe('http://fixture.test/npm/@scope%2Fpkg');
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      headers: { accept: 'application/vnd.npm.install-v1+json' },
      signal: controller.signal,
    });
    await expect(client.packument('-bad')).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('reports an aborted request as cancelled', async () => {
    const controller = new AbortController();
    const client = new NpmClient({
      fetch: async () => {
        controller.abort();
        throw new DOMException('aborted', 'AbortError');
      },
      endpoints,
    });
    await expect(client.packument('a', controller.signal)).rejects.toMatchObject({
      code: 'cancelled',
    });
  });

  it('refetches versions once the cache entry is old', async () => {
    let now = 0;
    const fetch = vi.fn<FetchFn>(async () => json({ versions: { '1.0.0': {} } }));
    const client = new NpmClient({ fetch, endpoints, now: () => now });
    await client.versions('a');
    now = 10 * 60_000;
    await client.versions('a');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('throws typed errors', async () => {
    const notFound = new NpmClient({ fetch: async () => json({}, 404), endpoints });
    await expect(notFound.versions('missing')).rejects.toMatchObject({
      code: 'not-found',
    });

    const offline = new NpmClient({
      fetch: async () => {
        throw new TypeError('fetch failed');
      },
      endpoints,
    });
    await expect(offline.search('x')).rejects.toMatchObject({ code: 'network' });

    const client = new NpmClient({ fetch: async () => json({}), endpoints });
    await expect(client.versions('../etc')).rejects.toBeInstanceOf(FiddleError);
    await expect(client.latestVersion('empty')).rejects.toMatchObject({
      code: 'not-found',
    });
  });
});
