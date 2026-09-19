import fs from 'node:fs/promises';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defaultClientConditions, defineConfig, type Plugin } from 'vite';

// The app:// handler serves only files listed in bundle-manifest.json.
// Packaged builds strip source maps, so production manifests leave them out.
function bundleManifest(mode: string): Plugin {
  return {
    name: 'fiddle:bundle-manifest',
    apply: 'build',
    enforce: 'post',
    async writeBundle(options, bundle) {
      if (!options.dir) throw new Error('bundle-manifest needs build.outDir');
      const files = Object.keys(bundle)
        .filter((file) => mode !== 'production' || !file.endsWith('.map'))
        .sort();
      await fs.writeFile(
        path.join(options.dir, 'bundle-manifest.json'),
        `${JSON.stringify({ files }, null, 2)}\n`,
      );
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), bundleManifest(mode)],
  build: {
    outDir: '.vite/renderer/main_window',
    emptyOutDir: true,
    copyPublicDir: false,
    sourcemap: mode !== 'test',
    minify: mode === 'production',
    target: 'chrome140',
    // Never inline assets as data: URLs; the CSP allows data: only for images.
    assetsInlineLimit: 0,
  },
  resolve: {
    conditions: ['fiddle-source', ...defaultClientConditions],
  },
  worker: {
    format: 'es',
  },
}));
