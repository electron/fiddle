import { spawn } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { killTree } from './kill-tree';

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

describe.skipIf(process.platform === 'win32')('killTree', () => {
  it('stops a detached child and the children it started', async () => {
    const script =
      'const { spawn } = require("node:child_process");' +
      'const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "inherit" });' +
      'console.log(child.pid); setInterval(() => {}, 1000)';
    const child = spawn(process.execPath, ['-e', script], {
      detached: true,
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    const grandchild = await new Promise<number>((resolve) =>
      child.stdout.once('data', (data: Buffer) => resolve(Number(data.toString()))),
    );
    const closed = new Promise((resolve) => child.once('close', resolve));
    killTree(child);
    await closed;
    await expect.poll(() => alive(grandchild)).toBe(false);
  });
});
