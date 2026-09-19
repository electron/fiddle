/**
 * The headless CLI's entry: which exit code and which output each way of
 * finishing gets. The commands themselves are faked.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ErrorCode } from '../../shared/errors';
import { CliErrorCode } from './output';

vi.mock('electron', () => ({
  app: {
    dock: { hide: vi.fn() },
    disableHardwareAcceleration: vi.fn(),
    whenReady: async () => undefined,
    exit: vi.fn(),
  },
}));
vi.mock('../i18n', () => ({
  initMainI18n: async () => undefined,
  tm: () => (key: string, values?: Record<string, string>) =>
    values ? `${key} ${values.message ?? ''}`.trim() : key,
}));
vi.mock('./argv', () => ({ helpText: () => 'HELP\n', parseCommandLine: vi.fn() }));
vi.mock('./commands', () => ({ runCommand: vi.fn() }));

const consoleMethods = { log: console.log, info: console.info, debug: console.debug };
const signalListeners = {
  SIGINT: process.listeners('SIGINT'),
  SIGTERM: process.listeners('SIGTERM'),
};

afterEach(() => {
  vi.restoreAllMocks();
  Object.assign(console, consoleMethods);
  for (const [signal, keep] of Object.entries(signalListeners) as [
    'SIGINT' | 'SIGTERM',
    NodeJS.SignalsListener[],
  ][]) {
    for (const listener of process.listeners(signal))
      if (!keep.includes(listener)) process.off(signal, listener);
  }
});

/** Modules are reloaded for each launch, so errors come from the registry the entry uses. */
async function fiddleError(code: string, message: string): Promise<Error> {
  const { FiddleError } = await import('../../shared/errors');
  return new FiddleError(code, message);
}

type RunCommand = (
  id: string,
  input: unknown,
  options: { signal: AbortSignal },
) => Promise<number>;

async function launch(
  args: string[],
  options: {
    parse?: () => unknown;
    parseError?: [string, string];
    run?: RunCommand;
  } = {},
) {
  vi.resetModules();
  const { app } = await import('electron');
  const { parseCommandLine } = await import('./argv');
  const { runCommand } = await import('./commands');
  const { FiddleError } = await import('../../shared/errors');
  vi.mocked(parseCommandLine).mockImplementation(((): unknown => {
    if (options.parseError)
      throw new FiddleError(options.parseError[0], options.parseError[1]);
    return (
      options.parse?.() ?? {
        kind: 'run',
        command: 'run',
        input: {},
        json: args.includes('--json'),
      }
    );
  }) as never);
  vi.mocked(runCommand).mockImplementation((options.run ?? (async () => 0)) as never);

  const out = { stdout: '', stderr: '' };
  for (const name of ['stdout', 'stderr'] as const) {
    vi.spyOn(process[name], 'write').mockImplementation(((
      chunk: string,
      ...rest: unknown[]
    ) => {
      out[name] += chunk;
      (rest.find((arg) => typeof arg === 'function') as (() => void) | undefined)?.();
      return true;
    }) as never);
  }
  const { startHeadless } = await import('./index');
  const exit = vi.mocked(app.exit);
  exit.mockClear();
  startHeadless(args);
  await vi.waitFor(() => expect(exit).toHaveBeenCalled());
  const events = out.stdout
    .split('\n')
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  return { code: exit.mock.calls[0]![0] as number, events, ...out };
}

describe('headlessArgs', () => {
  it.each([
    [
      ['electron-fiddle', '--headless', 'run', 'x'],
      ['run', 'x'],
    ],
    [['electron-fiddle', '--no-sandbox', '--headless'], []],
    [['electron-fiddle', 'run'], undefined],
    [
      [
        'electron-fiddle',
        'electron-fiddle://gist/1',
        '--headless',
        'run',
        'x',
        '--trust',
      ],
      undefined,
    ],
  ])('%j gives %j', async (argv, expected) => {
    const { headlessArgs } = await import('./index');
    expect(headlessArgs(argv)).toEqual(expected);
  });

  it('skips the app path of an unpackaged run', async () => {
    const { headlessArgs } = await import('./index');
    const argv = ['electron', '--no-sandbox', '/app', '--headless', 'run', 'x'];
    expect(headlessArgs(argv, true)).toEqual(['run', 'x']);
    expect(headlessArgs(argv, false)).toBeUndefined();
  });
});

describe('exit codes', () => {
  it('exits with the code a command returns', async () => {
    expect((await launch(['--headless', 'run'], { run: async () => 3 })).code).toBe(3);
    expect((await launch(['--headless', 'run'], { run: async () => 0 })).code).toBe(0);
  });

  it('prints the help and exits 0', async () => {
    const result = await launch(['--headless', '--help'], {
      parse: () => ({ kind: 'help' }),
    });
    expect(result).toMatchObject({ code: 0, stdout: 'HELP\n' });
  });

  it.each([
    [ErrorCode.invalidArgument, 64],
    [ErrorCode.notFound, 66],
    [ErrorCode.unavailable, 69],
    [ErrorCode.internal, 70],
    [ErrorCode.network, 75],
    [ErrorCode.unauthorized, 77],
    [ErrorCode.forbidden, 77],
    [CliErrorCode.untrusted, 77],
    [ErrorCode.installFailed, 1],
    [CliErrorCode.taskFailed, 1],
    [CliErrorCode.bisectFailed, 1],
  ])('a %s error exits %i and is the last JSON event', async (code, exitCode) => {
    const result = await launch(['--headless', 'run', '--json'], {
      run: async () => {
        throw await fiddleError(code, 'it failed');
      },
    });
    expect(result.code).toBe(exitCode);
    expect(result.events.at(-1)).toEqual({
      schemaVersion: 1,
      type: 'result',
      command: 'run',
      ok: false,
      error: { code, message: 'it failed' },
    });
  });

  it('exits 130 without an error when a command is cancelled, as at a Ctrl+C on a prompt', async () => {
    const result = await launch(['--headless', 'run', '--json'], {
      run: async () => {
        throw await fiddleError(ErrorCode.cancelled, 'cancelled');
      },
    });
    expect(result).toMatchObject({ code: 130, events: [] });
  });

  it('exits 64 for a command line that does not parse, with the error on stderr', async () => {
    const parseError: [string, string] = [ErrorCode.invalidArgument, 'unknown option'];
    const plain = await launch(['--headless', 'run', '--nope'], { parseError });
    expect(plain).toMatchObject({ code: 64, stdout: '' });
    expect(plain.stderr).toContain('unknown option');

    const json = await launch(['--headless', 'run', '--json'], { parseError });
    expect(json.code).toBe(64);
    expect(json.events).toEqual([
      {
        schemaVersion: 1,
        type: 'result',
        command: null,
        ok: false,
        error: { code: 'invalid-argument', message: 'unknown option' },
      },
    ]);
  });

  it('exits 70 for an unexpected error, and never reports a system error code as its own', async () => {
    const errno = Object.assign(new Error('EACCES: permission denied, mkdir /x'), {
      code: 'EACCES',
    });
    const result = await launch(['--headless', 'export', '--json'], {
      run: async () => {
        throw errno;
      },
    });
    expect(result.code).toBe(70);
    expect(result.events.at(-1)).toMatchObject({
      ok: false,
      error: { code: 'internal' },
    });

    const plain = await launch(['--headless', 'run'], {
      run: async () => {
        throw new TypeError('boom');
      },
    });
    expect(plain.code).toBe(70);
  });
});

describe('signals', () => {
  it('exits 130 when a signal stopped a command that then finished normally', async () => {
    const result = await launch(['--headless', 'run'], {
      run: async () => {
        process.emit('SIGTERM');
        return 0;
      },
    });
    expect(result.code).toBe(130);
  });

  it('gives the command a signal to stop with, and exits 130 without printing an error', async () => {
    const result = await launch(['--headless', 'run', '--json'], {
      run: (_id, _input, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('stopped')));
          process.emit('SIGINT');
        }),
    });
    expect(result).toMatchObject({ code: 130, events: [] });
  });

  it('exits at once on a second signal, however the command is doing', async () => {
    const result = await launch(['--headless', 'run'], {
      run: () =>
        new Promise<number>(() => {
          process.emit('SIGINT');
          process.emit('SIGINT');
        }),
    });
    expect(result.code).toBe(130);
  });

  it('stops the command when its output pipe is closed', async () => {
    const result = await launch(['--headless', 'run'], {
      run: (_id, _input, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
          process.stdout.emit(
            'error',
            Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }),
          );
        }),
    });
    expect(result.code).toBe(130);
  });
});
