import { readFileSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FiddleError } from '../shared/errors';
import {
  flushLog,
  formatEntry,
  initLogFile,
  log,
  logProcessErrors,
  LogFile,
} from './log';

const home = os.homedir();
const token = `ghp_${'Zz09'.repeat(9)}`;

describe('formatEntry', () => {
  it('writes one JSON line with a timestamp, level and process', () => {
    const line = formatEntry(
      'warn',
      'hello',
      [],
      'renderer',
      new Date('2026-01-02T03:04:05.000Z'),
    );
    expect(line).not.toContain('\n');
    expect(JSON.parse(line)).toEqual({
      t: '2026-01-02T03:04:05.000Z',
      level: 'warn',
      process: 'renderer',
      msg: 'hello',
    });
  });

  it('redacts tokens, secret-named values and the home directory', () => {
    const error = new Error(`cannot read ${path.join(home, 'secret.txt')}`);
    const line = formatEntry('error', `sign-in with ${token} from ${home}/x`, [
      error,
      { apiKey: 'plain-value', nested: { GITHUB_TOKEN: token, file: `${home}/y` } },
    ]);
    expect(line).not.toContain(token);
    expect(line).not.toContain('plain-value');
    expect(line).not.toContain(home);
    const entry = JSON.parse(line);
    expect(entry.level).toBe('error');
    expect(entry.msg).toBe('sign-in with [redacted] from ~/x');
    expect(entry.details[0]).toMatchObject({
      name: 'Error',
      message: `cannot read ${path.join('~', 'secret.txt')}`,
    });
    expect(entry.details[1]).toEqual({
      apiKey: '[redacted]',
      nested: { GITHUB_TOKEN: '[redacted]', file: '~/y' },
    });
  });

  it('survives cycles and odd values', () => {
    const cyclic: Record<string, unknown> = { n: 1n };
    cyclic.self = cyclic;
    expect(JSON.parse(formatEntry('info', 'x', [cyclic])).details[0]).toEqual({
      n: '1',
      self: '[circular]',
    });
  });
});

describe('formatEntry errors and shared objects', () => {
  it('keeps FiddleError details and the cause chain', () => {
    const cause = new TypeError('fetch failed');
    const error = new FiddleError('network', 'offline', { url: 'https://x.test', cause });
    const [entry] = JSON.parse(formatEntry('warn', 'x', [error])).details;
    expect(entry).toMatchObject({
      code: 'network',
      details: {
        url: 'https://x.test',
        cause: { name: 'TypeError', message: 'fetch failed' },
      },
    });
    const wrapped = JSON.parse(formatEntry('warn', 'x', [new Error('outer', { cause })]))
      .details[0];
    expect(wrapped.cause).toMatchObject({ name: 'TypeError', message: 'fetch failed' });
  });

  it('prints an object shared twice in full and cuts only real cycles', () => {
    const shared = { a: 1 };
    const looped = new Error('loop');
    looped.cause = looped;
    const [entry, error] = JSON.parse(
      formatEntry('info', 'x', [{ first: shared, second: shared }, looped]),
    ).details;
    expect(entry).toEqual({ first: { a: 1 }, second: { a: 1 } });
    expect(error.cause).toBe('[circular]');
  });
});

describe('LogFile', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'fiddle-log-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('appends lines to main.log', async () => {
    const file = new LogFile(dir);
    file.write('{"a":1}');
    file.write('{"a":2}');
    await file.flush();
    expect(await readFile(path.join(dir, 'main.log'), 'utf8')).toBe('{"a":1}\n{"a":2}\n');
  });

  it('rotates at the size limit and keeps three files', async () => {
    const file = new LogFile(dir, { maxBytes: 100, maxFiles: 3 });
    for (let i = 0; i < 20; i++) file.write(JSON.stringify({ i, pad: 'x'.repeat(30) }));
    await file.flush();

    expect((await readdir(dir)).sort()).toEqual(['main.1.log', 'main.2.log', 'main.log']);
    const read = async (name: string) =>
      (await readFile(path.join(dir, name), 'utf8'))
        .trim()
        .split('\n')
        .map((line) => (JSON.parse(line) as { i: number }).i);
    for (const name of ['main.log', 'main.1.log', 'main.2.log']) {
      expect((await stat(path.join(dir, name))).size).toBeLessThanOrEqual(100);
    }
    // Newest last in main.log; older entries shift into .1 and .2; the oldest are gone.
    const [current, older, oldest] = await Promise.all(
      ['main.log', 'main.1.log', 'main.2.log'].map(read),
    );
    expect(current!.at(-1)).toBe(19);
    expect(Math.max(...older!)).toBeLessThan(Math.min(...current!));
    expect(Math.max(...oldest!)).toBeLessThan(Math.min(...older!));
    expect(oldest![0]).toBeGreaterThan(0);
  });

  it('continues an existing file and rotates it when full', async () => {
    const first = new LogFile(dir, { maxBytes: 50 });
    first.write('x'.repeat(40));
    await first.flush();
    const second = new LogFile(dir, { maxBytes: 50 });
    second.write('y'.repeat(20));
    await second.flush();
    expect(await readFile(path.join(dir, 'main.1.log'), 'utf8')).toBe(
      `${'x'.repeat(40)}\n`,
    );
    expect(await readFile(path.join(dir, 'main.log'), 'utf8')).toBe(
      `${'y'.repeat(20)}\n`,
    );
  });
});

describe('flushLog', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'fiddle-log-'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  it('resolves once the entries logged so far are in the file', async () => {
    initLogFile(dir);
    log.error('startup failed', new Error('boom'));
    await flushLog();
    expect(await readFile(path.join(dir, 'main.log'), 'utf8')).toContain(
      'startup failed',
    );
  });
});

describe('logProcessErrors', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'fiddle-log-'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  it('logs an uncaught exception straight to the file, and an unhandled rejection', async () => {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    vi.spyOn(process, 'on').mockImplementation(((event: string, handler: never) => {
      handlers.set(event, handler);
      return process;
    }) as never);
    initLogFile(dir);
    logProcessErrors();

    handlers.get('uncaughtExceptionMonitor')!(new Error(`boom in ${home}`), 'x');
    const file = path.join(dir, 'main.log');
    const [entry] = readFileSync(file, 'utf8').trim().split('\n');
    expect(JSON.parse(entry!)).toMatchObject({
      level: 'error',
      msg: 'uncaught exception',
      details: [{ name: 'Error', message: 'boom in ~' }],
    });

    handlers.get('unhandledRejection')!(new Error('nobody caught this'));
    await flushLog();
    const lines = readFileSync(file, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[1]!)).toMatchObject({
      msg: 'unhandled rejection',
      details: [{ message: 'nobody caught this' }],
    });
  });
});
