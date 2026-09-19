import { Worker } from 'node:worker_threads';

/**
 * Fire-and-forget: runs `exec --version` off this thread's event loop, right
 * after a fresh extract. `child_process.spawn()` makes Windows' `CreateProcess`
 * call synchronously on whichever thread calls it, and Windows Defender's
 * real-time scan of a binary it has never seen can hold that call for many
 * seconds — which is what a real run's `Runner.spawn()` was blocking on,
 * freezing the whole main process. A worker thread has its own event loop, so
 * only the warm-up's thread blocks, not this process's main one; by the time
 * a real run spawns the same file, Defender has already cached it as clean.
 * Errors are ignored: a failed warm-up just means the real run pays for the
 * scan itself, as before.
 */
export function warmExecutable(exec: string): void {
  if (process.platform !== 'win32') return;
  try {
    const worker = new Worker(
      `
      const { workerData } = require('node:worker_threads');
      const { spawn } = require('node:child_process');
      const done = () => process.exit(0);
      try {
        const child = spawn(workerData.exec, ['--version'], {
          stdio: 'ignore',
          windowsHide: true,
        });
        child.on('exit', done);
        child.on('error', done);
      } catch {
        done();
      }
      `,
      { eval: true, workerData: { exec } },
    );
    worker.unref();
    worker.on('error', () => {});
  } catch {
    // best effort
  }
}
