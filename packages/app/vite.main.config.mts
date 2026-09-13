// Main process bundle. Standalone: `vite build -c vite.main.config.ts` gives the
// same output Forge's Vite plugin does (.vite/build/main.js, CommonJS).
import { builtinModules } from 'node:module';

import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  // Test builds (`--mode test`, tools/driver-build.ts) compile in test mode and
  // the e2e driver (src/main/test-driver); every other mode drops them.
  define: {
    __FIDDLE_TEST_BUILD__: JSON.stringify(mode === 'test'),
    // CommonJS has no `import.meta`, and Rolldown would replace it with `{}`.
    // Bundled ESM dependencies (@electron/get) call createRequire(import.meta.url).
    // The banner declares this name, so a module's own `require` can't shadow it.
    'import.meta.url': '__fiddleImportMetaUrl',
  },
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
      // Electron, Node built-ins and native modules stay external; all other
      // runtime JS is bundled. forge.config.ts copies native modules into the app.
      external: [
        'electron',
        /^electron\//,
        '@electron-internal/extract-zip',
        ...builtinModules.flatMap((name) => [name, `node:${name}`]),
      ],
      output: {
        banner: 'var __fiddleImportMetaUrl = require("node:url").pathToFileURL(__filename).href;',
      },
    },
  },
  resolve: {
    // `fiddle-source` resolves @electron/fiddle-core from its TypeScript source.
    conditions: ['fiddle-source', 'node'],
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
}));
