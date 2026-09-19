#!/usr/bin/env node
// `yarn start:xvfb`: builds main, preload and renderer in development mode (no dev server),
// then runs Electron on the result, under `xvfb-run` on Linux. Extra arguments go to Electron.
// FIDDLE_DEV_SCREENSHOT=/tmp/x.png captures the first window; FIDDLE_DEV_QUIT=1 quits after it.
import path from 'node:path';

import electronPath from 'electron';
import { build } from 'vite';

import { needsNoSandbox, runAndExit } from './electron-run.mjs';

const appDir = path.resolve(import.meta.dirname, '..');

for (const config of [
  'vite.main.config.mts',
  'vite.preload.config.mts',
  'vite.renderer.config.mts',
]) {
  await build({
    configFile: path.join(appDir, config),
    root: appDir,
    mode: 'development',
    logLevel: 'warn',
  });
}

const electronArgs = [
  ...(needsNoSandbox() ? ['--no-sandbox'] : []),
  appDir,
  ...process.argv.slice(2),
];
const [command, args] =
  process.platform === 'linux'
    ? ['xvfb-run', ['-a', electronPath, ...electronArgs]]
    : [electronPath, electronArgs];

runAndExit(command, args, { cwd: appDir });
