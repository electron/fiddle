import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

// The component gallery (Develop > Open component gallery) is a second page, left out of release builds.
const galleryPage = fileURLToPath(
  new URL('./src/ui/gallery/index.html', import.meta.url),
);
const appPage = fileURLToPath(new URL('./index.html', import.meta.url));

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
    ...(mode !== 'production' && {
      rollupOptions: { input: { index: appPage, gallery: galleryPage } },
    }),
  },
  resolve: {
    conditions: ['fiddle-source', ...defaultClientConditions],
  },
  worker: {
    format: 'es',
  },
}));
