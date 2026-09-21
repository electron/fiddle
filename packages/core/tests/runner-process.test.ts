import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ElectronVersions, Fiddle, Installer, Runner } from '../src/index.js';

// These tests spawn real processes. Node stands in for Electron: it is an
// executable file, so the Runner treats it as a local build.
const electron = process.execPath;

function collector() {
  const chunks: string[] = [];
  const out = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      callback();
    },
  });
  return { out, text: () => chunks.join('') };
}

describe('Runner with a real child process', () => {
  let tmpdir: string;
  let runner: Runner;

  beforeEach(async () => {
    tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'fiddle-core-'));
    runner = await Runner.create({
      installer: new Installer({
        electronDownloads: path.join(tmpdir, 'downloads'),
        electronVersions: path.join(tmpdir, 'versions'),
      }),
      versions: new ElectronVersions([]),
    });
  });

  afterEach(() => {
    fs.rmSync(tmpdir, { recursive: true, force: true });
  });

  let count = 0;
  const fiddle = (main: string) => {
    const dir = path.join(tmpdir, `fiddle-${++count}`);
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'main.js'), main);
    return new Fiddle(path.join(dir, 'main.js'), 'test');
  };
  const exited = (child: import('node:child_process').ChildProcess) =>
    new Promise<number | null>((resolve) => child.once('close', resolve));

  it('leaves `out` open, so later runs can write to it', async () => {
    const { out, text } = collector();
    const opts = { out, showConfig: false };
    await exited(
      await runner.spawn(electron, fiddle('process.stdout.write("first\\n");'), opts),
    );
    await expect.poll(text).toContain('first');
    expect(out.writableEnded).toBe(false);

    await exited(
      await runner.spawn(electron, fiddle('process.stderr.write("second\\n");'), opts),
    );
    await expect.poll(text).toContain('second');
  });

  it('starts the inspector on a random local port and does not list it over HTTP', async () => {
    const { out, text } = collector();
    const child = await runner.spawn(electron, fiddle('setTimeout(() => {}, 5000);'), {
      out,
      showConfig: false,
      inspect: {},
    });
    const closed = exited(child);
    try {
      const banner = /Debugger listening on ws:\/\/127\.0\.0\.1:(\d+)\/[\w-]+/;
      await expect.poll(text, { timeout: 10_000 }).toMatch(banner);
      const port = Number(banner.exec(text())![1]);
      expect(port).toBeGreaterThan(0);

      // Without the id from the child's output, another process cannot attach.
      const listed = await fetch(`http://127.0.0.1:${port}/json/list`);
      expect(listed.status).toBe(404);
    } finally {
      child.kill();
      await closed;
    }
  });

  it.skipIf(process.platform === 'win32')(
    'starts the launcher with Electron, the flags and the fiddle as its arguments',
    async () => {
      const argsFile = path.join(tmpdir, 'launcher-args');
      const launcher = path.join(tmpdir, 'launcher.sh');
      fs.writeFileSync(
        launcher,
        `#!/bin/sh\nprintf '%s\\n' "$@" > ${JSON.stringify(argsFile)}\nexec "$@"\n`,
        { mode: 0o755 },
      );

      const child = await runner.spawn(electron, fiddle('process.exit(1);'), {
        out: undefined,
        showConfig: false,
        args: ['--no-warnings'],
        launcher,
      });

      // the exit code passes through the launcher's exec
      expect(await exited(child)).toBe(1);
      const [exec, flag, main] = fs.readFileSync(argsFile, 'utf8').trim().split('\n');
      expect([exec, flag]).toEqual([electron, '--no-warnings']);
      expect(path.basename(main!)).toBe('main.js');
    },
  );
});
