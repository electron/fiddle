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
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import electronPath from 'electron';
import { build } from 'vite';

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

// Chromium's sandbox needs a setuid chrome-sandbox on Linux, which containers
// usually lack. Only this dev tooling ever passes --no-sandbox.
function needsNoSandbox() {
  if (process.platform !== 'linux') return false;
  try {
    const stat = fs.statSync(path.join(path.dirname(electronPath), 'chrome-sandbox'));
    return !(stat.uid === 0 && stat.mode & 0o4000) || process.getuid?.() === 0;
  } catch {
    return true;
  }
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

const child = spawn(command, args, { stdio: 'inherit', cwd: appDir });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
