// Main process bundle. Standalone: `vite build -c vite.main.config.ts` gives the
// same output Forge's Vite plugin does (.vite/build/main.js, CommonJS).
import { builtinModules } from 'node:module';

import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  build: {
    outDir: '.vite/build',
    emptyOutDir: false,
    copyPublicDir: false,
    sourcemap: true,
    minify: mode === 'production',
    target: 'node24',
    lib: {
      entry: 'src/main/index.ts',
      formats: ['cjs'],
      fileName: () => 'main.js',
    },
    rollupOptions: {
      // Only Electron and Node built-ins stay external; all other runtime JS is bundled.
      external: [
        'electron',
        /^electron\//,
        ...builtinModules.flatMap((name) => [name, `node:${name}`]),
      ],
    },
  },
  resolve: {
    // `fiddle-source` resolves @electron/fiddle-core from its TypeScript source.
    conditions: ['fiddle-source', 'node'],
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
}));
