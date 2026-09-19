import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { mapToFiddleFile, OutputParser } from './output-parser';

const root = path.join(os.tmpdir(), 'electron-fiddle-abc');
const fileUrl = (name: string) => pathToFileURL(path.join(root, name)).href;
const files = ['main.js', 'preload.js', 'renderer.js', 'index.html'];
const parser = (chromiumLogs = false) =>
  new OutputParser({ roots: [root], files, chromiumLogs });

describe('mapToFiddleFile', () => {
  it('maps paths and file URLs inside the run directory', () => {
    expect(mapToFiddleFile(`${root}/main.js`, [root], files)).toBe('main.js');
    expect(mapToFiddleFile(fileUrl('renderer.js'), [root], files)).toBe('renderer.js');
  });

  it('ignores other paths and unknown files', () => {
    expect(mapToFiddleFile('/elsewhere/main.js', [root], files)).toBeUndefined();
    expect(
      mapToFiddleFile(`${root}/node_modules/x/index.js`, [root], files),
    ).toBeUndefined();
    expect(
      mapToFiddleFile('node:internal/modules/cjs/loader', [root], files),
    ).toBeUndefined();
  });
});

describe('OutputParser', () => {
  it('passes stdout through as main output, across chunk boundaries', () => {
    const p = parser();
    expect(p.push('stdout', 'hello wo').lines).toEqual([]);
    expect(p.push('stdout', 'rld\nsecond\n').lines).toEqual([
      { process: 'main', kind: 'log', text: 'hello world' },
      { process: 'main', kind: 'log', text: 'second' },
    ]);
  });

  it('shows the start of a huge line without a newline, without growing or slowing down', () => {
    const p = parser();
    const chunk = 'x'.repeat(64 * 1024);
    for (let i = 0; i < 1000; i++) expect(p.push('stdout', chunk).lines).toEqual([]);
    const { lines } = p.push('stdout', '\nnext\n');
    expect(lines.map((line) => line.text)).toEqual([`${'x'.repeat(10_000)}…`, 'next']);
  });

  it('drops the inspector banner and reports its port', () => {
    const result = parser().push(
      'stderr',
      'Debugger listening on ws://127.0.0.1:43127/7a2c-11\nFor help, see: https://nodejs.org/en/docs/inspector\n',
    );
    expect(result.lines).toEqual([]);
    expect(result.inspectorPort).toBe(43127);
    // Newer Node points somewhere else.
    expect(
      parser().push(
        'stderr',
        'For help, see: https://nodejs.org/learn/getting-started/debugging\n',
      ).lines,
    ).toEqual([]);
  });

  it('maps an uncaught renderer error to renderer.js with its line', () => {
    const result = parser().push(
      'stderr',
      `[1234:0913/194208.123456:ERROR:CONSOLE(4)] "Uncaught TypeError: Cannot read properties of undefined (reading 'getVibrancy')", source: ${fileUrl('renderer.js')} (4)\n`,
    );
    expect(result.lines).toEqual([
      {
        process: 'renderer',
        kind: 'error',
        text: "Uncaught TypeError: Cannot read properties of undefined (reading 'getVibrancy')",
        location: { file: 'renderer.js', line: 4 },
      },
    ]);
    expect(result.errors).toEqual([
      {
        process: 'renderer',
        file: 'renderer.js',
        line: 4,
        name: 'TypeError',
        message: "Cannot read properties of undefined (reading 'getVibrancy')",
      },
    ]);
  });

  it('treats an uncaught error logged at INFO (Chromium 140+) as an error', () => {
    const result = parser().push(
      'stderr',
      `[3775310:0913/225440.282724:INFO:CONSOLE:4] "Uncaught TypeError: Cannot read properties of undefined (reading 'getVibrancy')", source: ${fileUrl('renderer.js')} (4)\n`,
    );
    expect(result.lines[0]).toMatchObject({
      kind: 'error',
      location: { file: 'renderer.js', line: 4 },
    });
    expect(result.errors).toHaveLength(1);
  });

  it('reads the newer CONSOLE:line format and console.log messages', () => {
    const result = parser().push(
      'stderr',
      `[99:0913/1.2:INFO:CONSOLE:12] "Loaded index.html", source: ${fileUrl('renderer.js')} (12)\n`,
    );
    expect(result.lines).toEqual([
      { process: 'renderer', kind: 'log', text: 'Loaded index.html' },
    ]);
    expect(result.errors).toEqual([]);
  });

  it('joins a console message that spans several lines', () => {
    const p = parser();
    expect(p.push('stderr', '[1:2:0913/1.2:WARNING:CONSOLE(1)] "first\n').lines).toEqual(
      [],
    );
    const result = p.push('stderr', `second", source: ${fileUrl('renderer.js')} (7)\n`);
    expect(result.lines).toEqual([
      {
        process: 'renderer',
        kind: 'warn',
        text: 'first\nsecond',
        location: { file: 'renderer.js', line: 7 },
      },
    ]);
  });

  it('prefers a stack frame with a column, and maps preload errors to preload', () => {
    const result = parser().push(
      'stderr',
      `[1:2:0913/1.2:ERROR:CONSOLE(2)] "Uncaught Error: boom\\n    at ${root}/preload.js:3:9", source: node:electron/js2c/sandbox_bundle (2)\n`,
    );
    expect(result.errors).toEqual([
      {
        process: 'preload',
        file: 'preload.js',
        line: 3,
        column: 9,
        name: 'Error',
        message: `boom\\n    at ${root}/preload.js:3:9`,
      },
    ]);
  });

  it('drops Chromium log lines unless advanced logging is on', () => {
    const line =
      '[1234:1234:0913/194208.1:ERROR:bus.cc(407)] Failed to connect to the bus\n';
    expect(parser().push('stderr', line).lines).toEqual([]);
    expect(parser(true).push('stderr', line).lines).toHaveLength(1);
  });

  it('maps a main-process stack trace to main.js', () => {
    const result = parser().push(
      'stderr',
      [
        'App threw an error during load',
        "TypeError: Cannot read properties of undefined (reading 'foo')",
        `    at Object.<anonymous> (${root}/main.js:3:15)`,
        '    at Module._compile (node:internal/modules/cjs/loader:1484:14)',
        '',
      ].join('\n'),
    );
    expect(result.errors).toEqual([
      {
        process: 'main',
        file: 'main.js',
        line: 3,
        column: 15,
        name: 'TypeError',
        message: "Cannot read properties of undefined (reading 'foo')",
      },
    ]);
    expect(result.lines.map((l) => l.kind)).toEqual(['log', 'error', 'error', 'error']);
    expect(result.lines[2]?.location).toEqual({ file: 'main.js', line: 3, column: 15 });
  });

  it('flushes a trailing partial line', () => {
    const p = parser();
    p.push('stdout', 'no newline');
    expect(p.flush().lines).toEqual([
      { process: 'main', kind: 'log', text: 'no newline' },
    ]);
  });
});
