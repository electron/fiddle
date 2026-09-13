#!/usr/bin/env node
// `yarn fiddle <command>`: the headless CLI (REQUIREMENTS §7) against the dev build.
//
// Builds main in development mode (like `yarn start:xvfb`, main only), then
// runs `electron <app> --headless <command>` in the caller's directory,
// passing stdio through and exiting with the CLI's exit code. Run
// `yarn generate` first if the i18n catalogs or EIPC schemas changed.
//
//   FIDDLE_CLI_SKIP_BUILD=1   reuse the last build of main
//   FIDDLE_CLI_VERBOSE=1      keep main's info logs (on stderr)
//
// Headless mode needs no display, but a fiddle that opens windows does: on a
// Linux machine without one, use `xvfb-run -a yarn fiddle run ...`.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import electronPath from 'electron';
import { build } from 'vite';

const appDir = path.resolve(import.meta.dirname, '..');

if (process.env.FIDDLE_CLI_SKIP_BUILD !== '1') {
  await build({
    configFile: path.join(appDir, 'vite.main.config.mts'),
    root: appDir,
    mode: 'development',
    logLevel: 'warn',
  });
}

// Chromium's sandbox needs a setuid chrome-sandbox on Linux, which containers
// usually lack. Only dev tooling ever passes --no-sandbox (as start-headless.mjs).
function needsNoSandbox() {
  if (process.platform !== 'linux') return false;
  try {
    const stat = fs.statSync(path.join(path.dirname(electronPath), 'chrome-sandbox'));
    return !(stat.uid === 0 && stat.mode & 0o4000) || process.getuid?.() === 0;
  } catch {
    return true;
  }
}

const args = [
  ...(needsNoSandbox() ? ['--no-sandbox'] : []),
  // Keep Chromium's own startup noise (D-Bus, GPU) out of the CLI's stderr.
  ...(process.env.FIDDLE_CLI_VERBOSE === '1' ? [] : ['--log-level=3']),
  appDir,
  '--headless',
  ...process.argv.slice(2),
];
const child = spawn(electronPath, args, {
  stdio: 'inherit',
  // Yarn runs scripts in the package's folder; relative fiddle paths are the caller's.
  cwd: process.env.INIT_CWD || process.cwd(),
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
