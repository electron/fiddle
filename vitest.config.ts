import { defaultClientConditions, defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

// `fiddle-source` resolves @electron/fiddle-core from its TypeScript source.
// Added to Vite's defaults, never replacing them.
const nodeConditions = ['fiddle-source', ...defaultServerConditions];
const browserConditions = ['fiddle-source', ...defaultClientConditions];

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      // packages/core/vitest.config.ts (node environment).
      'packages/core',
      {
        resolve: { conditions: nodeConditions },
        ssr: { resolve: { conditions: nodeConditions } },
        test: {
          name: 'app:node',
          root: './packages/app',
          environment: 'node',
          include: ['src/{main,fiddle,shared}/**/*.test.ts'],
        },
      },
      {
        resolve: { conditions: browserConditions },
        test: {
          name: 'app:jsdom',
          root: './packages/app',
          environment: 'jsdom',
          include: ['src/{renderer,ui}/**/*.test.tsx'],
          setupFiles: ['./vitest.jsdom.setup.ts'],
        },
      },
    ],
  },
});
