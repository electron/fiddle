/**
 * Electron downloads in the headless CLI go through `net.fetch` (REQUIREMENTS
 * §7), so the system proxy and certificate store apply. This is an
 * `@electron/get` downloader, passed to core's Installer.
 */
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

export function fetchDownloader(fetchFn: typeof fetch): Downloader {
  return {
    async download(url: string, targetFilePath: string, options?: DownloadOptions) {
      const signal = options?.signal;
      const response = await fetchFn(url, signal ? { signal } : undefined);
      if (!response.ok || !response.body) throw new Error(`Downloading ${url} failed: HTTP ${response.status}`);
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
            transferred += chunk.length;
            progress(transferred, total ? transferred / total : 0);
            yield chunk;
          }
        },
        fs.createWriteStream(targetFilePath),
        signal ? { signal } : {},
      );
      progress(transferred, 1);
    },
  };
}
