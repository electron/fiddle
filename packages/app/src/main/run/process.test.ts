/** The window-free run pieces, with real child processes. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { isPackaged: false } }));

const { makeRunDir, stopChild, waitForExit, writeRunApp } = await import('./process');

const node = (script: string) =>
  spawn(process.execPath, ['-e', script], { stdio: ['ignore', 'pipe', 'pipe'] });

/** Resolves once the child has printed a line, so a signal handler is installed. */
function ready(child: ReturnType<typeof node>): Promise<void> {
  return new Promise((resolve) => child.stdout?.once('data', () => resolve()));
}

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('waitForExit', () => {
  it('resolves with the exit code, or the signal', async () => {
    expect(await waitForExit(node('process.exit(3)'))).toMatchObject({
      code: 3,
      signal: null,
    });
    const killed = node('setInterval(() => {}, 1000); console.log("up")');
    await ready(killed);
    killed.kill('SIGKILL');
    expect(await waitForExit(killed)).toMatchObject({ code: null, signal: 'SIGKILL' });
  });

  it('reports a spawn failure once, as spawnFailed', async () => {
    const onError = vi.fn();
    const child = spawn(path.join(process.cwd(), 'no-such-electron'), [], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(await waitForExit(child, onError)).toEqual({ spawnFailed: true });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toMatchObject({ code: 'ENOENT' });
  });
});

describe('stopChild', () => {
  it.skipIf(process.platform === 'win32')(
    'ends a child that handles SIGTERM with SIGTERM alone',
    async () => {
      const child = node(
        'process.on("SIGTERM", () => process.exit(7)); setInterval(() => {}, 1000); console.log("up")',
      );
      await ready(child);
      stopChild(child);
      expect(await waitForExit(child)).toMatchObject({ code: 7 });
    },
  );

  it.skipIf(process.platform === 'win32')(
    'kills a child that ignores SIGTERM after a second',
    async () => {
      const child = node(
        'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000); console.log("up")',
      );
      await ready(child);
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      try {
        stopChild(child);
        await vi.advanceTimersByTimeAsync(999);
        expect(child.signalCode).toBeNull();
        await vi.advanceTimersByTimeAsync(1);
      } finally {
        vi.useRealTimers();
      }
      expect(await waitForExit(child)).toMatchObject({ code: null, signal: 'SIGKILL' });
    },
  );
});

describe('run directories', () => {
  it('makes a private directory and writes the fiddle and a package.json into app/', async () => {
    const dir = await makeRunDir('fiddle-test-');
    dirs.push(dir);
    if (process.platform !== 'win32') expect(fs.statSync(dir).mode & 0o777).toBe(0o700);
    const appDir = await writeRunApp(
      dir,
      { 'main.js': 'console.log(1)' },
      { name: 'demo', main: 'main.js', author: 'me', modules: {} },
    );
    expect(appDir).toBe(path.join(dir, 'app'));
    expect(fs.readFileSync(path.join(appDir, 'main.js'), 'utf8')).toBe('console.log(1)');
    expect(
      JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8')),
    ).toMatchObject({ name: 'demo', main: './main.js' });
  });
});
