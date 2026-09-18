import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchDownloader } from './downloader';

let dir = '';

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'fiddle-download-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('fetchDownloader', () => {
  it('streams the body to the file through the given fetch, with progress', async () => {
    const fetchFn = vi.fn(
      async () => new Response('hello world', { headers: { 'content-length': '11' } }),
    );
    const percents: number[] = [];
    const file = path.join(dir, 'nested', 'electron.zip');
    await fetchDownloader(fetchFn as unknown as typeof fetch).download(
      'https://example.test/electron.zip',
      file,
      {
        getProgressCallback: (progress: { percent: number }) =>
          percents.push(progress.percent),
      },
    );
    expect(fetchFn).toHaveBeenCalledWith('https://example.test/electron.zip', undefined);
    expect(await readFile(file, 'utf8')).toBe('hello world');
    expect(percents.at(-1)).toBe(1);
  });

  it('passes the abort signal on', async () => {
    const fetchFn = vi.fn(async () => new Response('x'));
    const signal = new AbortController().signal;
    await fetchDownloader(fetchFn as unknown as typeof fetch).download(
      'https://example.test/a',
      path.join(dir, 'a'),
      { signal },
    );
    expect(fetchFn).toHaveBeenCalledWith('https://example.test/a', { signal });
  });

  it('fails on an HTTP error', async () => {
    const fetchFn = async () => new Response('missing', { status: 404 });
    await expect(
      fetchDownloader(fetchFn as unknown as typeof fetch).download(
        'https://example.test/b',
        path.join(dir, 'b'),
        {},
      ),
    ).rejects.toThrow('HTTP 404');
  });
});
