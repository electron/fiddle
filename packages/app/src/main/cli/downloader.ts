import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';

import type { InstallerOptions } from '@electron/fiddle-core';

type Downloader = NonNullable<InstallerOptions['downloader']>;

interface Progress {
  transferred: number;
  total: number | null;
  percent: number;
}

/** What core passes as `downloadOptions`. */
interface DownloadOptions {
  signal?: AbortSignal;
  getProgressCallback?: (progress: Progress) => unknown;
}

/** A download fails once nothing has arrived for this long, so a stalled mirror can't hang it. */
const STALL_MS = 30_000;

/** An `@electron/get` downloader on `net.fetch`, so the system proxy and certificate store apply. */
export function fetchDownloader(fetchFn: typeof fetch, stallMs = STALL_MS): Downloader {
  return {
    async download(url: string, targetFilePath: string, options?: DownloadOptions) {
      const stalled = new AbortController();
      const timer = setTimeout(
        () => stalled.abort(new Error(`Downloading ${url} failed: no data received`)),
        stallMs,
      );
      const signal = options?.signal
        ? AbortSignal.any([options.signal, stalled.signal])
        : stalled.signal;
      try {
        const response = await fetchFn(url, { signal });
        if (!response.ok || !response.body) {
          await response.body?.cancel().catch(() => undefined);
          throw new Error(`Downloading ${url} failed: HTTP ${response.status}`);
        }
        // Headers are in: from here on the clock is on the body.
        timer.refresh();
        const length = Number(response.headers.get('content-length'));
        const total = Number.isFinite(length) && length > 0 ? length : null;
        const progress = (transferred: number, percent: number) =>
          void options?.getProgressCallback?.({ transferred, total, percent });
        let transferred = 0;
        await fsp.mkdir(path.dirname(targetFilePath), { recursive: true });
        await pipeline(
          Readable.fromWeb(response.body as NodeReadableStream<Uint8Array>),
          async function* (source: AsyncIterable<Buffer>) {
            for await (const chunk of source) {
              timer.refresh();
              transferred += chunk.length;
              progress(transferred, total ? transferred / total : 0);
              yield chunk;
            }
          },
          fs.createWriteStream(targetFilePath),
          { signal },
        );
        progress(transferred, 1);
      } catch (err) {
        throw stalled.signal.aborted ? stalled.signal.reason : err;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
