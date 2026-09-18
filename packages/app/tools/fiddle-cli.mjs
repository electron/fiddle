#!/usr/bin/env node
// `yarn fiddle <command>`: the headless CLI against the dev build.
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
import path from 'node:path';

import electronPath from 'electron';

import { needsNoSandbox, runAndExit } from './electron-run.mjs';

const appDir = path.resolve(import.meta.dirname, '..');

if (process.env.FIDDLE_CLI_SKIP_BUILD !== '1') {
  const { build } = await import('vite');
  await build({
    configFile: path.join(appDir, 'vite.main.config.mts'),
    root: appDir,
    mode: 'development',
    logLevel: 'warn',
  });
}

const args = [
  ...(needsNoSandbox() ? ['--no-sandbox'] : []),
  // Keep Chromium's own startup noise (D-Bus, GPU) out of the CLI's stderr.
  ...(process.env.FIDDLE_CLI_VERBOSE === '1' ? [] : ['--log-level=3']),
  appDir,
  '--headless',
  ...process.argv.slice(2),
];
// Yarn runs scripts in the package's folder; relative fiddle paths are the caller's.
runAndExit(electronPath, args, { cwd: process.env.INIT_CWD || process.cwd() });
