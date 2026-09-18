// Shared by the dev tools that start Electron (fiddle-cli.mjs, start-headless.mjs).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import electronPath from 'electron';

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

/** Runs a command with inherited stdio, forwards SIGINT and SIGTERM, and exits with its exit code. */
export function runAndExit(command, args, options) {
  const child = spawn(command, args, { stdio: 'inherit', ...options });
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => child.kill(signal));
  child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
}
