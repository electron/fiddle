import { EventEmitter } from 'node:events';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  flushAll: vi.fn<() => Promise<void>>(),
  hasPendingWrites: vi.fn<() => boolean>(),
  flushDocuments: vi.fn(),
}));

vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events');
  return {
    app: Object.assign(new EventEmitter(), { quit: vi.fn() }),
    powerMonitor: new EventEmitter(),
  };
});
vi.mock('../log');
vi.mock('./json-store', () => ({
  flushAll: mocks.flushAll,
  hasPendingWrites: mocks.hasPendingWrites,
}));

import { app, powerMonitor } from 'electron';

import { flushLog } from '../log';
import { installFlushOnExit } from './lifecycle';

const emitter = app as unknown as EventEmitter & { quit: ReturnType<typeof vi.fn> };
const power = powerMonitor as unknown as EventEmitter;

function willQuit(): { preventDefault: ReturnType<typeof vi.fn> } {
  const event = { preventDefault: vi.fn() };
  emitter.emit('will-quit', event);
  return event;
}

beforeEach(() => {
  vi.useFakeTimers();
  emitter.removeAllListeners();
  power.removeAllListeners();
  emitter.quit.mockClear();
  mocks.flushAll.mockReset().mockResolvedValue(undefined);
  mocks.hasPendingWrites.mockReset().mockReturnValue(false);
  vi.mocked(flushLog).mockClear();
  mocks.flushDocuments.mockClear();
  installFlushOnExit(mocks.flushDocuments);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('installFlushOnExit', () => {
  it('lets the quit through when nothing is pending', () => {
    expect(willQuit().preventDefault).not.toHaveBeenCalled();
    expect(mocks.flushAll).not.toHaveBeenCalled();
  });

  it('holds the quit until the flush is done, then quits on a later turn', async () => {
    mocks.hasPendingWrites.mockReturnValue(true);
    expect(willQuit().preventDefault).toHaveBeenCalledOnce();
    expect(mocks.flushAll).toHaveBeenCalledOnce();
    expect(emitter.quit).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(0);
    expect(flushLog).toHaveBeenCalledOnce();
    expect(emitter.quit).toHaveBeenCalledOnce();
  });

  it('still quits when the flush fails', async () => {
    mocks.hasPendingWrites.mockReturnValue(true);
    mocks.flushAll.mockRejectedValue(new Error('disk full'));
    willQuit();
    await vi.advanceTimersByTimeAsync(0);
    expect(emitter.quit).toHaveBeenCalledOnce();
  });

  it('gives up on a write that hangs, and then lets the quit through', async () => {
    mocks.hasPendingWrites.mockReturnValue(true);
    mocks.flushAll.mockReturnValue(new Promise(() => undefined));
    willQuit();
    await vi.advanceTimersByTimeAsync(4999);
    expect(emitter.quit).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2);
    expect(emitter.quit).toHaveBeenCalledOnce();
    expect(willQuit().preventDefault).not.toHaveBeenCalled();
  });

  it('flushes drafts and stores when a window ends its session', () => {
    const window = new EventEmitter();
    emitter.emit('browser-window-created', {}, window);
    window.emit('session-end');
    expect(mocks.flushDocuments).toHaveBeenCalledOnce();
    expect(mocks.flushAll).toHaveBeenCalledOnce();
  });

  it('holds the system shutdown until the flush is done', async () => {
    const event = { preventDefault: vi.fn() };
    power.emit('shutdown', event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(mocks.flushDocuments).toHaveBeenCalledOnce();
    expect(mocks.flushAll).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(0);
    expect(emitter.quit).toHaveBeenCalledOnce();
  });
});
