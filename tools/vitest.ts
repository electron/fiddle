import { spawn } from 'node:child_process';
import * as path from 'node:path';

// When required from Node.js (rather than Electron's main process), the
// `electron` module resolves to the path of the Electron executable.
const electron = require('electron') as unknown as string;
const vitestPkg = require.resolve('vitest/package.json');
const vitestCli = path.join(path.dirname(vitestPkg), 'vitest.mjs');

const child = spawn(electron, [vitestCli, ...process.argv.slice(2)], {
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
