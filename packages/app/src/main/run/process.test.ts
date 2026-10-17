/** The window-free run pieces, with real child processes. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { isPackaged: false } }));
const launcher = vi.fn<() => string | undefined>(() => undefined);
vi.mock('../platform/disclaim', () => ({ disclaimLauncher: launcher }));

const shellPath = vi.fn<() => Promise<string | undefined>>();
vi.mock('../../fiddle/modules', async (original) => ({
  ...(await original<typeof import('../../fiddle/modules')>()),
  loadLoginShellPath: shellPath,
}));

const { killTree } = await import('../../fiddle/kill-tree');
const { makeRunDir, spawnElectron, sweepStaleDirs, toolEnv, waitForExit, writeRunApp } =
  await import('./process');

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

  it('ends soon after the child exits even when a process it left behind holds the output pipes', async () => {
    const started = Date.now();
    const child = node(
      `require('node:child_process').spawn(process.execPath, ['-e', 'setTimeout(() => {}, 8000)'], { detached: true, stdio: 'inherit' }).unref()`,
    );
    expect(await waitForExit(child)).toMatchObject({ code: 0 });
    expect(Date.now() - started).toBeLessThan(4000);
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

describe('toolEnv', () => {
  it("looks the login shell's PATH up once, but tries again after a lookup that found nothing", async () => {
    shellPath.mockResolvedValueOnce(undefined);
    expect((await toolEnv()).PATH).toBe(process.env.PATH);
    shellPath.mockResolvedValue('/opt/homebrew/bin:/usr/bin');
    expect((await toolEnv()).PATH).toBe('/opt/homebrew/bin:/usr/bin');
    expect((await toolEnv()).PATH).toBe('/opt/homebrew/bin:/usr/bin');
    expect(shellPath).toHaveBeenCalledTimes(2);
  });
});

describe('killTree on a run', () => {
  it.skipIf(process.platform === 'win32')(
    'ends a child that handles SIGTERM with SIGTERM alone',
    async () => {
      const child = node(
        'process.on("SIGTERM", () => process.exit(7)); setInterval(() => {}, 1000); console.log("up")',
      );
      await ready(child);
      killTree(child);
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
        killTree(child);
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

/** Node stands in for Electron: both take a script and the inspector flags. */
describe('spawnElectron', () => {
  const spawnNode = (dir: string, inspect: boolean) =>
    spawnElectron({
      exec: process.execPath,
      appDir: path.join(dir, 'app'),
      runDir: dir,
      flags: ['--no-warnings'],
      keepUserDataDirs: true,
      env: {},
      advancedLogging: false,
      inspect,
    });

  it('starts the inspector on a random local port and does not list it over HTTP', async () => {
    const dir = await makeRunDir('fiddle-test-');
    dirs.push(dir);
    await writeRunApp(
      dir,
      { 'main.js': 'setTimeout(() => {}, 5000)' },
      { name: 'demo', main: 'main.js', author: 'me', modules: {} },
    );
    const child = spawnNode(dir, true);
    let text = '';
    child.stderr?.on('data', (chunk) => (text += String(chunk)));
    const closed = waitForExit(child);
    try {
      const banner = /Debugger listening on ws:\/\/127\.0\.0\.1:(\d+)\/[\w-]+/;
      await expect.poll(() => text, { timeout: 10_000 }).toMatch(banner);
      // Without the id from the child's output, another process cannot attach.
      const listed = await fetch(`http://127.0.0.1:${banner.exec(text)![1]}/json/list`);
      expect(listed.status).toBe(404);
    } finally {
      child.kill();
      await closed;
    }
  });

  it.skipIf(process.platform === 'win32')(
    'starts the launcher with Electron, the flags and the fiddle as its arguments',
    async () => {
      const dir = await makeRunDir('fiddle-test-');
      dirs.push(dir);
      await writeRunApp(
        dir,
        { 'main.js': 'process.exit(1)' },
        { name: 'demo', main: 'main.js', author: 'me', modules: {} },
      );
      const argsFile = path.join(dir, 'launcher-args');
      const script = path.join(dir, 'launcher.sh');
      fs.writeFileSync(
        script,
        `#!/bin/sh\nprintf '%s\\n' "$@" > ${JSON.stringify(argsFile)}\nexec "$@"\n`,
        { mode: 0o755 },
      );
      launcher.mockReturnValueOnce(script);
      // The exit code passes through the launcher's exec.
      expect(await waitForExit(spawnNode(dir, false))).toMatchObject({ code: 1 });
      expect(fs.readFileSync(argsFile, 'utf8').trim().split('\n')).toEqual([
        process.execPath,
        '--no-warnings',
        path.join(dir, 'app'),
      ]);
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

describe('sweepStaleDirs', () => {
  it('removes old run dirs and abandoned projects, and nothing else', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fiddle-sweep-'));
    dirs.push(root);
    const dayAgo = Date.now() / 1000 - 2 * 24 * 60 * 60;
    const make = (name: string, old: boolean, out = false) => {
      const dir = path.join(root, name);
      fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, 'file'), 'x');
      if (out) fs.mkdirSync(path.join(dir, 'out'));
      if (old) fs.utimesSync(dir, dayAgo, dayAgo);
    };
    make('electron-fiddle-aB3dE9', true);
    make('electron-fiddle-package-aB3dE9', true);
    make('electron-fiddle-make-aB3dE9', true);
    make('electron-fiddle-package-Qw3rTy', true, true);
    make('electron-fiddle-make-Qw3rTy', true, true);
    make('electron-fiddle-Zz9Yy8', false);
    make('electron-fiddle-notes', true);
    make('other-aB3dE9', true);
    await sweepStaleDirs(root);
    expect(fs.readdirSync(root).sort()).toEqual([
      'electron-fiddle-Zz9Yy8',
      'electron-fiddle-make-Qw3rTy',
      'electron-fiddle-notes',
      'electron-fiddle-package-Qw3rTy',
      'other-aB3dE9',
    ]);
  });
});
