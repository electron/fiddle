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

// main.tsx imports App, and with it Monaco, once the App store has answered. Preloading that chunk graph from the
// page overlaps its fetch with the entry chunk's.
function preloadApp(): Plugin {
  return {
    name: 'fiddle:preload-app',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, { bundle, chunk }) {
        if (!bundle || chunk?.name !== 'index') return [];
        const app = Object.values(bundle).find(
          (item) =>
            item.type === 'chunk' && item.facadeModuleId?.endsWith('/renderer/App.tsx'),
        );
        if (!app) return [];
        const seen = new Set<string>();
        const walk = (file: string) => {
          if (seen.has(file)) return;
          seen.add(file);
          const item = bundle[file];
          if (item?.type === 'chunk') item.imports.forEach(walk);
        };
        walk(chunk.fileName);
        const loaded = new Set(seen);
        walk(app.fileName);
        return [...seen]
          .filter((file) => !loaded.has(file))
          .map((file) => ({
            tag: 'link',
            attrs: { rel: 'modulepreload', crossorigin: true, href: `./${file}` },
            injectTo: 'head' as const,
          }));
      },
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
  plugins: [react(), bundleManifest(mode), preloadApp()],
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
