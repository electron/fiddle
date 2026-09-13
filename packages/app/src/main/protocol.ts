/**
 * The privileged app:// scheme. App content is served from the renderer
 * bundle through `protocol.handle`, with the CSP as a response header.
 * Never registered with `bypassCSP`; service workers stay off.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import { protocol } from 'electron';

import { APP_SCHEME, BUNDLE_MANIFEST, resolveBundleFile } from './bundle';
import { PRODUCTION_CSP } from './csp';
import { log } from './log';

/** Must run before the app's `ready` event. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        codeCache: true,
      },
    },
  ]);
}

function headers(contentType: string): Record<string, string> {
  return {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': PRODUCTION_CSP,
  };
}

export async function handleAppProtocol(rendererDir: string): Promise<void> {
  const { files } = JSON.parse(
    await fs.readFile(path.join(rendererDir, BUNDLE_MANIFEST), 'utf8'),
  ) as { files: string[] };
  const manifest = new Set(files);

  protocol.handle(APP_SCHEME, async (request) => {
    const found =
      request.method === 'GET' ? resolveBundleFile(manifest, request.url) : undefined;
    if (!found) {
      log.warn('app:// refused', request.method, request.url);
      return new Response('Not found', {
        status: 404,
        headers: headers('text/plain; charset=utf-8'),
      });
    }
    const body = await fs.readFile(path.join(rendererDir, found.file));
    return new Response(body, { headers: headers(found.mimeType) });
  });
}
