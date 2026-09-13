// Preload bundle. Windows use `sandbox: true`, so the preload must be a single
// CommonJS file that requires nothing but `electron`.
// Standalone: `vite build -c vite.preload.config.ts` -> .vite/build/preload.js.
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  build: {
    outDir: '.vite/build',
    emptyOutDir: false,
    copyPublicDir: false,
    sourcemap: 'inline',
    minify: mode === 'production',
    target: 'chrome140',
    rollupOptions: {
      input: 'src/preload/index.ts',
      external: ['electron', 'electron/renderer'],
      output: {
        format: 'cjs',
        codeSplitting: false,
        entryFileNames: 'preload.js',
      },
    },
  },
}));
