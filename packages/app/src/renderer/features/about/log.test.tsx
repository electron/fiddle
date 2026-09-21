/** Tests the renderer's logger: what reaches the console and main's log file, and the forwarding of uncaught errors. */
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  Log: vi.fn((_level: string, _text: string) => Promise.resolve()),
}));

vi.mock('../../../ipc/renderer', () => ({ appPlatformApi: { Log: mocks.Log } }));

import { forwardUncaughtErrors, log } from './log';

const sent = () => mocks.Log.mock.calls.map(([level, text]) => ({ level, text }));

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('renderer log', () => {
  it('writes to the console as is, and sends main one line: the message, then each detail described', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = new Error('boom');
    log.warn('publishing failed', error, { gist: 'abc' }, 'retrying');
    expect(warn).toHaveBeenCalledWith(
      'publishing failed',
      error,
      { gist: 'abc' },
      'retrying',
    );
    const [entry] = sent();
    expect(entry?.level).toBe('warn');
    expect(entry?.text.startsWith('publishing failed Error: boom\n')).toBe(true);
    expect(entry?.text).toContain(error.stack);
    expect(entry?.text.endsWith(' {"gist":"abc"} retrying')).toBe(true);
  });

  it('logs info through console.log and errors through console.error', () => {
    const info = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    log.info('started');
    log.error('crashed');
    expect(info).toHaveBeenCalledWith('started');
    expect(error).toHaveBeenCalledWith('crashed');
    expect(sent()).toEqual([
      { level: 'info', text: 'started' },
      { level: 'error', text: 'crashed' },
    ]);
  });

  it('describes a detail JSON cannot take by its string form, and caps the line at main’s limit', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    log.info('odd', circular);
    log.info('x'.repeat(20_000));
    expect(sent()[0]?.text).toBe('odd [object Object]');
    expect(sent()[1]?.text).toHaveLength(10_000);
  });

  it('never throws, even outside a window, where the bridge is missing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.Log.mockImplementationOnce(() => {
      throw new TypeError('no bridge');
    });
    expect(() => log.error('outside a window')).not.toThrow();
  });

  it('forwards uncaught errors and unhandled rejections to main as errors', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    forwardUncaughtErrors();
    const thrown = new Error('render failed');
    window.dispatchEvent(new ErrorEvent('error', { error: thrown, message: 'ignored' }));
    // A cross-origin script error carries only a message.
    window.dispatchEvent(new ErrorEvent('error', { message: 'Script error.' }));
    const rejection = new Event('unhandledrejection');
    Object.defineProperty(rejection, 'reason', { value: 'offline' });
    window.dispatchEvent(rejection);
    expect(sent().map((entry) => entry.level)).toEqual(['error', 'error', 'error']);
    expect(sent()[0]?.text.startsWith('uncaught error Error: render failed')).toBe(true);
    expect(sent()[1]?.text).toBe('uncaught error Script error.');
    expect(sent()[2]?.text).toBe('unhandled rejection offline');
  });
});
