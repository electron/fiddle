/**
 * What app:// may serve: only files listed in the renderer's bundle manifest
 * (written by vite.renderer.config.ts), each with a known MIME type.
 * No Electron imports, so it's unit-tested under plain Node.
 */
import path from 'node:path';

export const APP_SCHEME = 'app';
export const APP_HOST = 'main';
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
export const BUNDLE_MANIFEST = 'bundle-manifest.json';

export const MIME_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
};

export interface BundleFile {
  /** Path relative to the renderer output directory. */
  file: string;
  mimeType: string;
}

/** Maps an app:// URL to a file in the bundle, or undefined if it must not be served. */
export function resolveBundleFile(
  manifest: ReadonlySet<string>,
  requestUrl: string,
): BundleFile | undefined {
  let url: URL;
  let pathname: string;
  try {
    url = new URL(requestUrl);
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return undefined;
  }
  if (url.protocol !== `${APP_SCHEME}:` || url.host !== APP_HOST) return undefined;
  const file = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  if (!manifest.has(file)) return undefined;
  const mimeType = MIME_TYPES[path.extname(file).toLowerCase()];
  return mimeType ? { file, mimeType } : undefined;
}
