// The headless CLI of the test build, in test mode against the fixture server.
// Fiddles run with Chromium's headless Ozone backend, so no display is needed.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { APP_DIR, electronArgs, TEST_BUILD_DIR } from './driver.ts';
import { startFixtureServer, type FixtureServer } from './fixtures/server.ts';

interface CliRun {
  code: number | null;
  stdout: string;
  stderr: string;
  /** The `--json` lines; the last one is the result. */
  lines: Record<string, unknown>[];
}

describe('headless CLI', () => {
  const electron = createRequire(path.join(APP_DIR, 'package.json'))(
    'electron',
  ) as string;
  let fixtures: FixtureServer;
  let dir: string;

  beforeAll(async () => {
    fixtures = await startFixtureServer();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fiddle-e2e-cli-'));
  });

  afterAll(async () => {
    await fixtures?.close();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  const cli = (...args: string[]) =>
    new Promise<CliRun>((resolve, reject) => {
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        FIDDLE_TEST_MODE: '1',
        FIDDLE_TEST_DIR: dir,
        FIDDLE_TEST_FIXTURE_URL: fixtures.url,
        LANG: 'en_US.UTF-8',
        LC_ALL: 'en_US.UTF-8',
      };
      delete env.ELECTRON_RUN_AS_NODE;
      delete env.NODE_OPTIONS;
      const child = spawn(
        electron,
        [
          ...electronArgs(electron),
          '--log-level=3',
          TEST_BUILD_DIR,
          '--headless',
          ...args,
        ],
        {
          env,
          cwd: dir,
        },
      );
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
      child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
      child.once('error', reject);
      child.once('exit', (code) =>
        resolve({
          code,
          stdout,
          stderr,
          lines: stdout
            .split('\n')
            .filter((line) => line.startsWith('{'))
            .map((line) => JSON.parse(line) as Record<string, unknown>),
        }),
      );
    });

  const fiddle = (name: string, main: string) => {
    const folder = path.join(dir, name);
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'main.js'), main);
    return folder;
  };
  // The fiddle's own Electron: no display, and no sandbox where the app's has none.
  const fiddleFlags = () => [
    '--flag=--ozone-platform=headless',
    ...electronArgs(electron)
      .filter((arg) => arg === '--no-sandbox')
      .map((arg) => `--flag=${arg}`),
  ];

  it('lists versions as JSON, with the stable and beta channels by default', async () => {
    const run = await cli('versions', 'list', '--json');
    expect(run.code, run.stderr).toBe(0);
    const result = run.lines.at(-1) as {
      ok: boolean;
      data: { versions: { version: string; channel: string }[] };
    };
    expect(result.ok).toBe(true);
    const listed = result.data.versions.map((v) => `${v.version} ${v.channel}`);
    expect(listed).toEqual(
      expect.arrayContaining(['44.3.0 stable', '43.7.0 stable', '45.0.0-alpha.6 beta']),
    );
  }, 60_000);

  it("exits with the fiddle's exit code", async () => {
    const run = await cli(
      'run',
      fiddle('fails', 'process.exit(3);\n'),
      '--json',
      ...fiddleFlags(),
    );
    expect(run.code, run.stderr).toBe(3);
    expect(run.lines.at(-1)).toMatchObject({
      ok: true,
      data: { result: 'failure', exitCode: 3 },
    });
  }, 180_000);

  it('succeeds with exit code 0 and never passes blocked variables', async () => {
    const main =
      "console.log('LD_PRELOAD=' + (process.env.LD_PRELOAD ?? 'unset'));\nprocess.exit(0);\n";
    const run = await cli(
      'run',
      fiddle('passes', main),
      '--json',
      ...fiddleFlags(),
      '--env=LD_PRELOAD=/tmp/evil.so',
    );
    expect(run.code, run.stderr).toBe(0);
    expect(run.stdout).toContain('LD_PRELOAD=unset');
    expect(run.lines.at(-1)).toMatchObject({
      ok: true,
      data: { result: 'success', exitCode: 0 },
    });
  }, 120_000);

  it('exits with 64 for an unknown command', async () => {
    const run = await cli('nope', '--json');
    expect(run.code).toBe(64);
    expect(run.lines.at(-1)).toMatchObject({ ok: false });
  }, 60_000);
});
