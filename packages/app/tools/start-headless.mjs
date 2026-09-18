#!/usr/bin/env node
// `yarn start:xvfb`: a headless dev run for agents and CI.
//
// Builds main, preload and renderer with the standalone Vite configs
// (development mode: unminified, with source maps; no dev server), then starts
// Electron on the result under `xvfb-run` on Linux. Content loads over
// app://main exactly as in a packaged build. Extra arguments go to Electron.
//
// Dev-only environment variables (read only when the app is not packaged):
//   FIDDLE_DEV_SCREENSHOT=/tmp/x.png   capture the first window once it's ready
//   FIDDLE_DEV_QUIT=1                  quit after that screenshot
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
