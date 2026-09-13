// @ts-check
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const ipcRendererBan = {
  selector: "Identifier[name='ipcRenderer']",
  message:
    'ipcRenderer is never used or exposed. Use the EIPC bindings in src/ipc/renderer.ts.',
};

export default defineConfig(
  globalIgnores([
    '**/node_modules/',
    '**/.vite/',
    '**/out/',
    '**/dist/',
    '**/coverage/',
    '.yarn/',
    'docs/',
    '**/tests/fixtures/',
    'packages/app/static/',
    'packages/app/src/ipc/generated/',
    'packages/app/src/i18n/generated/',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    // Plain Node scripts and configs (TypeScript files get no-undef from tsc instead).
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
  {
    files: ['packages/app/src/**/*.{ts,tsx}'],
    ...reactHooks.configs.flat.recommended,
  },
  {
    // Fiddle logic runs under plain Node in unit tests.
    files: ['packages/app/src/fiddle/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'electron', message: 'src/fiddle must not import electron.' }],
          patterns: [
            { group: ['electron/*'], message: 'src/fiddle must not import electron.' },
          ],
        },
      ],
    },
  },
  {
    // Renderers are views: they reach main only through the EIPC wrappers.
    files: ['packages/app/src/{renderer,ui}/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'electron',
              message: 'Renderers talk to main through src/ipc/renderer.ts.',
            },
          ],
          patterns: [
            {
              group: ['electron/*'],
              message: 'Renderers talk to main through src/ipc/renderer.ts.',
            },
            {
              group: ['**/ipc/generated/**'],
              message:
                'Import IPC from src/ipc/renderer.ts, which re-throws FiddleErrors.',
            },
          ],
        },
      ],
      'no-restricted-syntax': ['error', ipcRendererBan],
    },
  },
  {
    files: ['packages/app/src/preload/**'],
    rules: { 'no-restricted-syntax': ['error', ipcRendererBan] },
  },
);
