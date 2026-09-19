import { builtinModules } from 'node:module';

import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  define: {
    // Only `--mode test` builds include the e2e driver.
    __FIDDLE_TEST_BUILD__: JSON.stringify(mode === 'test'),
    // CommonJS has no `import.meta`, and Rolldown would replace it with `{}`, but
    // bundled ESM dependencies call createRequire(import.meta.url). The banner
    // declares this name so a module's own `require` can't shadow it.
    'import.meta.url': '__fiddleImportMetaUrl',
  },
  build: {
    outDir: '.vite/build',
    emptyOutDir: false,
    copyPublicDir: false,
    sourcemap: mode !== 'test',
    minify: mode === 'production',
    target: 'node24',
    lib: {
      entry: 'src/main/index.ts',
      formats: ['cjs'],
      fileName: () => 'main.js',
    },
    rollupOptions: {
      // Native modules stay external; forge.config.ts copies them into the app.
      external: [
        'electron',
        /^electron\//,
        '@electron-internal/extract-zip',
        ...builtinModules.flatMap((name) => [name, `node:${name}`]),
      ],
      output: {
        banner:
          'var __fiddleImportMetaUrl = require("node:url").pathToFileURL(__filename).href;',
      },
    },
  },
  resolve: {
    conditions: ['fiddle-source', 'node'],
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
}));
