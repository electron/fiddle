import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BaseVersions, Runner } from '../src/index.js';

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
  // stdout and stderr both pipe here; don't let the first to finish end it
  out.end = (() => out) as Writable['end'];
  return { out, text: () => chunks.join('') };
}

describe('Runner with a real child process', () => {
  let tmpdir: string;
  let runner: Runner;

  beforeEach(async () => {
    tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'fiddle-core-'));
    runner = await Runner.create({
      paths: {
        electronDownloads: path.join(tmpdir, 'downloads'),
        electronInstall: path.join(tmpdir, 'install'),
        fiddles: path.join(tmpdir, 'fiddles'),
      },
      versions: new BaseVersions([]),
    });
  });

  afterEach(() => {
    fs.rmSync(tmpdir, { recursive: true, force: true });
  });

  const fiddle = (main: string) => new Map([['main.js', main]]);

  it('reports the exit code', async () => {
    const main = 'process.exit(Number(process.env.EXIT_CODE ?? 0));';
    const opts = { out: undefined, showConfig: false };
    await expect(runner.run(electron, fiddle(main), opts)).resolves.toStrictEqual({
      status: 'test_passed',
    });
    const failing = { ...opts, childEnv: { vars: { EXIT_CODE: '1' } } };
    await expect(runner.run(electron, fiddle(main), failing)).resolves.toStrictEqual({
      status: 'test_failed',
    });
  });

  it('filters the child environment', async () => {
    const outFile = path.join(tmpdir, 'env.json');
    const main = `require('node:fs').writeFileSync(process.env.OUT_FILE, JSON.stringify(process.env));`;
    const result = await runner.run(electron, fiddle(main), {
      out: undefined,
      showConfig: false,
      env: { ...process.env, GITHUB_TOKEN: 'secret', SENTRY_DSN: 'dsn' },
      childEnv: {
        vars: { OUT_FILE: outFile, MY_VAR: 'hi', LD_PRELOAD: '/nonexistent.so' },
      },
    });
    expect(result.status).toBe('test_passed');

    const env = JSON.parse(fs.readFileSync(outFile, 'utf8')) as Record<string, string>;
    expect(env).toHaveProperty('MY_VAR', 'hi');
    expect(env).not.toHaveProperty('GITHUB_TOKEN');
    expect(env).not.toHaveProperty('SENTRY_DSN');
    expect(env).not.toHaveProperty('LD_PRELOAD');
  });

  it('starts the inspector on a random local port', async () => {
    const { out, text } = collector();
    const child = await runner.spawn(electron, fiddle('setTimeout(() => {}, 100);'), {
      out,
      showConfig: false,
      inspect: {},
    });
    await new Promise((resolve) => child.once('close', resolve));

    const match = /Debugger listening on ws:\/\/127\.0\.0\.1:(\d+)\//.exec(text());
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThan(0);
  });

  it('kills the child and rejects when aborted', async () => {
    const pidFile = path.join(tmpdir, 'pid');
    const main = `require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(() => {}, 1000);`;
    const controller = new AbortController();
    const run = runner.run(electron, fiddle(main), {
      out: undefined,
      showConfig: false,
      signal: controller.signal,
    });

    await expect.poll(() => fs.existsSync(pidFile)).toBe(true);
    controller.abort();
    await expect(run).rejects.toHaveProperty('code', 'aborted');

    const pid = Number(fs.readFileSync(pidFile, 'utf8'));
    await expect
      .poll(() => {
        try {
          process.kill(pid, 0);
          return true;
        } catch {
          return false;
        }
      })
      .toBe(false);
  });
});
