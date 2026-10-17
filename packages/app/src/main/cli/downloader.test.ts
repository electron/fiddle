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
    expect(fetchFn).toHaveBeenCalledWith('https://example.test/electron.zip', {
      signal: expect.any(AbortSignal),
    });
    expect(await readFile(file, 'utf8')).toBe('hello world');
    expect(percents.at(-1)).toBe(1);
  });

  it('passes the abort signal on', async () => {
    let seen: AbortSignal | undefined;
    const fetchFn = async (_url: string, init?: RequestInit) => {
      seen = init?.signal ?? undefined;
      return new Response('x');
    };
    const controller = new AbortController();
    await fetchDownloader(fetchFn as unknown as typeof fetch).download(
      'https://example.test/a',
      path.join(dir, 'a'),
      { signal: controller.signal },
    );
    controller.abort();
    expect(seen?.aborted).toBe(true);
  });

  it('fails when the body stops arriving', async () => {
    const fetchFn = async () =>
      // one chunk, then nothing, with the connection left open
      new Response(new ReadableStream({ start: (c) => c.enqueue(new Uint8Array(1)) }));
    await expect(
      fetchDownloader(fetchFn as unknown as typeof fetch, 50).download(
        'https://example.test/c',
        path.join(dir, 'c'),
        {},
      ),
    ).rejects.toThrow('no data received');
  });

  it('gives the headers and then the first chunk each the full stall window', async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const fetchFn = async () => {
      await wait(70);
      return new Response(
        new ReadableStream({
          async start(c) {
            await wait(70);
            c.enqueue(new TextEncoder().encode('late'));
            c.close();
          },
        }),
      );
    };
    const file = path.join(dir, 'd');
    await fetchDownloader(fetchFn as unknown as typeof fetch, 100).download(
      'https://example.test/d',
      file,
      {},
    );
    expect(await readFile(file, 'utf8')).toBe('late');
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
