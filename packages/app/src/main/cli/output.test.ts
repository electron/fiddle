import { describe, expect, it } from 'vitest';

import { exitCodeForError, exitCodeForRun, localeFromEnv, Reporter, SCHEMA_VERSION } from './output';

function capture(json: boolean) {
  const out: string[] = [];
  const err: string[] = [];
  const reporter = new Reporter(json, 'run', { stdout: (text) => out.push(text), stderr: (text) => err.push(text) });
  const events = () =>
    out
      .join('')
      .trimEnd()
      .split('\n')
      .map((line) => JSON.parse(line) as unknown);
  return { reporter, out, err, events };
}

describe('Reporter with --json', () => {
  it('writes one JSON object per line, each with a schemaVersion', () => {
    const { reporter, err, events } = capture(true);
    reporter.log('Downloading');
    reporter.output('stdout', 'a\nb');
    reporter.output('stdout', 'c\n');
    reporter.output('stderr', 'oops');
    reporter.result({ exitCode: 3 }, 'not printed');
    expect(SCHEMA_VERSION).toBe(1);
    expect(events()).toEqual([
      { schemaVersion: 1, type: 'log', level: 'info', text: 'Downloading' },
      { schemaVersion: 1, type: 'output', stream: 'stdout', text: 'a' },
      { schemaVersion: 1, type: 'output', stream: 'stdout', text: 'bc' },
      { schemaVersion: 1, type: 'output', stream: 'stderr', text: 'oops' },
      { schemaVersion: 1, type: 'result', command: 'run', ok: true, data: { exitCode: 3 } },
    ]);
    expect(err).toEqual([]);
  });

  it('writes a failure as a result with the error code', () => {
    const { reporter, events } = capture(true);
    reporter.error({ code: 'untrusted', message: 'Add --trust' }, 'Error: Add --trust');
    reporter.error({ code: 'task-failed', message: 'npm failed', details: { code: 1 } }, '');
    expect(events()).toEqual([
      { schemaVersion: 1, type: 'result', command: 'run', ok: false, error: { code: 'untrusted', message: 'Add --trust' } },
      {
        schemaVersion: 1,
        type: 'result',
        command: 'run',
        ok: false,
        error: { code: 'task-failed', message: 'npm failed', details: { code: 1 } },
      },
    ]);
  });

  it('drops details that JSON cannot hold', () => {
    const { reporter, events } = capture(true);
    const details: Record<string, unknown> = {};
    details.self = details;
    reporter.error({ code: 'internal', message: 'boom', details }, '');
    expect(events()).toEqual([{ schemaVersion: 1, type: 'result', command: 'run', ok: false, error: { code: 'internal', message: 'boom' } }]);
  });
});

describe('Reporter without --json', () => {
  it('passes output through and keeps stdout for results', () => {
    const { reporter, out, err } = capture(false);
    reporter.log('Started');
    reporter.output('stdout', 'hello');
    reporter.output('stderr', 'warning');
    reporter.result({}, 'Done');
    reporter.error({ code: 'internal', message: 'x' }, 'Error: x');
    expect(out).toEqual(['hello', 'Done\n']);
    expect(err).toEqual(['Started\n', 'warning', 'Error: x\n']);
  });
});

describe('exit codes', () => {
  it.each([
    ['invalid-argument', 64],
    ['not-found', 66],
    ['unavailable', 69],
    ['internal', 70],
    ['network', 75],
    ['unauthorized', 77],
    ['untrusted', 77],
    ['cancelled', 130],
    ['task-failed', 1],
    ['bisect-failed', 1],
  ])('maps %s to %i', (code, exit) => {
    expect(exitCodeForError(code)).toBe(exit);
  });

  it("is the fiddle's own exit code for a run", () => {
    expect(exitCodeForRun({ code: 0, signal: null })).toBe(0);
    expect(exitCodeForRun({ code: 3, signal: null })).toBe(3);
    expect(exitCodeForRun({ code: null, signal: 'SIGTERM' })).toBe(143);
    expect(exitCodeForRun({ code: null, signal: 'SIGINT' })).toBe(130);
    expect(exitCodeForRun({})).toBe(1);
  });
});

describe('localeFromEnv', () => {
  it('reads LC_ALL, then LC_MESSAGES, then LANG', () => {
    expect(localeFromEnv({ LC_ALL: 'de_DE.UTF-8', LC_MESSAGES: 'fr_FR', LANG: 'es_ES' })).toEqual(['de-DE']);
    expect(localeFromEnv({ LC_ALL: '', LC_MESSAGES: 'fr_FR@euro', LANG: 'es_ES' })).toEqual(['fr-FR']);
    expect(localeFromEnv({ LANG: 'pt_BR.UTF-8' })).toEqual(['pt-BR']);
  });

  it('treats C and POSIX as English, and nothing as the default', () => {
    expect(localeFromEnv({ LANG: 'C.UTF-8' })).toEqual(['en']);
    expect(localeFromEnv({ LC_ALL: 'POSIX' })).toEqual(['en']);
    expect(localeFromEnv({})).toEqual([]);
  });
});
