import { defaultClientConditions, defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

// `fiddle-source` resolves @electron/fiddle-core from its TypeScript source.
// Added to Vite's defaults, never replacing them.
const nodeConditions = ['fiddle-source', ...defaultServerConditions];
const browserConditions = ['fiddle-source', ...defaultClientConditions];

export default defineConfig({
  test: {
    // `yarn test --coverage`. Generated bindings and the e2e driver are left out.
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.{ts,tsx}'],
      exclude: [
        '**/generated/**',
        '**/*.d.ts',
        '**/*.test.*',
        'packages/app/src/main/test-driver/**',
      ],
    },
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
          include: ['src/**/*.test.ts', 'tools/*.test.ts'],
        },
      },
      {
        resolve: { conditions: browserConditions },
        test: {
          name: 'app:jsdom',
          root: './packages/app',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['./vitest.jsdom.setup.ts'],
        },
      },
    ],
  },
});
