import { describe, expect, it } from 'vitest';

import { resolveBundleFile } from './bundle';

const manifest = new Set([
  'index.html',
  'assets/index-abc.js',
  'assets/font.woff2',
  'assets/notes.xyz',
]);

describe('resolveBundleFile', () => {
  it('serves the index for the root and listed files with their MIME type', () => {
    expect(resolveBundleFile(manifest, 'app://main/')).toEqual({
      file: 'index.html',
      mimeType: 'text/html; charset=utf-8',
    });
    expect(resolveBundleFile(manifest, 'app://main/assets/index-abc.js?v=1')).toEqual({
      file: 'assets/index-abc.js',
      mimeType: 'text/javascript; charset=utf-8',
    });
    expect(resolveBundleFile(manifest, 'app://main/assets/font.woff2')?.mimeType).toBe(
      'font/woff2',
    );
  });

  it('refuses files outside the manifest, other hosts and unknown types', () => {
    expect(resolveBundleFile(manifest, 'app://main/package.json')).toBeUndefined();
    expect(resolveBundleFile(manifest, 'app://main/../../main.js')).toBeUndefined();
    expect(resolveBundleFile(manifest, 'app://other/index.html')).toBeUndefined();
    expect(resolveBundleFile(manifest, 'app://main/assets/notes.xyz')).toBeUndefined();
    expect(resolveBundleFile(manifest, 'app://main/%E0%A4%A')).toBeUndefined();
  });
});
