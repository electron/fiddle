// Windows use `sandbox: true`, so the preload must be a single CommonJS file
// that requires nothing but `electron`.
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  build: {
    outDir: '.vite/build',
    emptyOutDir: false,
    copyPublicDir: false,
    // An inline map would ship inside preload.js; production writes a `.map` file
    // instead, which the packager strips.
    sourcemap: mode === 'production' ? true : 'inline',
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
