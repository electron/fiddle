#!/usr/bin/env node
// Dev launchers, and the build and spawn helpers the driver shares.
//   `xvfb [electron args]` (`yarn start:xvfb`): builds main, preload and renderer in development mode,
//     then runs Electron on the app, under `xvfb-run` on Linux. FIDDLE_DEV_SCREENSHOT=/tmp/x.png
//     captures the first window; FIDDLE_DEV_QUIT=1 quits after it.
//   `headless <command>` (`yarn fiddle`): builds main, then runs `electron <app> --headless <command>`
//     in the caller's directory. FIDDLE_CLI_SKIP_BUILD=1 reuses the last build; FIDDLE_CLI_VERBOSE=1
//     keeps main's info logs. A fiddle that opens windows needs a display: `xvfb-run -a yarn fiddle run ...`.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import electronPath from 'electron';

export const appDir = path.resolve(import.meta.dirname, '..');

// Chromium's sandbox needs a setuid chrome-sandbox on Linux, which containers
// usually lack. Only dev tooling ever passes --no-sandbox.
export function needsNoSandbox() {
  if (process.platform !== 'linux') return false;
  try {
    const stat = fs.statSync(path.join(path.dirname(electronPath), 'chrome-sandbox'));
    return !(stat.uid === 0 && stat.mode & 0o4000) || process.getuid?.() === 0;
  } catch {
    return true;
  }
}

/** Builds `targets` with their Vite configs in `mode`, into `outDir` instead of `.vite` if given. */
export async function buildApp(mode, outDir, targets = ['main', 'preload', 'renderer']) {
  const { build } = await import('vite');
  for (const target of targets) {
    const dir = target === 'renderer' ? 'renderer/main_window' : 'build';
    await build({
      configFile: path.join(appDir, `vite.${target}.config.mts`),
      root: appDir,
      mode,
      logLevel: 'warn',
      ...(outDir && { build: { outDir: path.join(outDir, dir) } }),
    });
  }
}

/** Runs `electron ...args` (no sandbox where there can't be one) with inherited stdio, forwards SIGINT and SIGTERM, and exits with its code. */
export function runElectron(args, { xvfb = false, cwd = appDir } = {}) {
  const electronArgs = [...(needsNoSandbox() ? ['--no-sandbox'] : []), ...args];
  const [command, commandArgs] =
    xvfb && process.platform === 'linux'
      ? ['xvfb-run', ['-a', electronPath, ...electronArgs]]
      : [electronPath, electronArgs];
  const child = spawn(command, commandArgs, { stdio: 'inherit', cwd });
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => child.kill(signal));
  child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
}

const [command, ...args] =
  process.argv[1] === import.meta.filename ? process.argv.slice(2) : [];
if (command === 'xvfb') {
  await buildApp('development');
  runElectron([appDir, ...args], { xvfb: true });
} else if (command === 'headless') {
  if (process.env.FIDDLE_CLI_SKIP_BUILD !== '1')
    await buildApp('development', undefined, ['main']);
  // Chromium's own startup noise (D-Bus, GPU) stays out of the CLI's stderr unless verbose.
  const quiet = process.env.FIDDLE_CLI_VERBOSE === '1' ? [] : ['--log-level=3'];
  // Yarn runs scripts in the package's folder; relative fiddle paths are the caller's.
  runElectron([...quiet, appDir, '--headless', ...args], {
    cwd: process.env.INIT_CWD || process.cwd(),
  });
}
