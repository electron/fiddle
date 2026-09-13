import { randomUUID } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { ErrorCode, FiddleError } from '../shared/errors';
import type { AppState, WindowState } from '../shared/stores';
import { StateHub, type WindowSink } from './state-hub';

const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakeSink() {
  const sink = {
    app: [] as AppState[],
    window: [] as WindowState[],
    pushApp: vi.fn((state: AppState) => void sink.app.push(state)),
    pushWindow: vi.fn((state: WindowState) => void sink.window.push(state)),
  } satisfies WindowSink & Record<string, unknown>;
  return sink;
}

function setup() {
  const hub = new StateHub({ locale: 'en', platform: 'linux', material: 'none' });
  const a = { id: randomUUID(), sink: fakeSink() };
  const b = { id: randomUUID(), sink: fakeSink() };
  hub.registerWindow(a.id, { title: 'A' }, a.sink);
  hub.registerWindow(b.id, { title: 'B' }, b.sink);
  return { hub, a, b };
}

describe('StateHub', () => {
  it('starts every store at rev 0', () => {
    const { hub, a } = setup();
    expect(hub.app.rev).toBe(0);
    expect(hub.getWindow(a.id)).toEqual({ rev: 0, windowId: a.id, title: 'A' });
  });

  it('returns the rev that includes each change', () => {
    const { hub, a } = setup();
    expect(hub.updateApp({ locale: 'de' })).toBe(1);
    expect(hub.updateApp({ locale: 'fr' })).toBe(2);
    expect(hub.updateWindow(a.id, { title: 'A2' })).toBe(1);
  });

  it('sends App changes to every window', async () => {
    const { hub, a, b } = setup();
    hub.updateApp({ locale: 'de' });
    await nextTick();
    expect(a.sink.app).toEqual([hub.app]);
    expect(b.sink.app).toEqual([hub.app]);
    expect(a.sink.pushWindow).not.toHaveBeenCalled();
  });

  it('sends Window changes only to their own window', async () => {
    const { hub, a, b } = setup();
    hub.updateWindow(b.id, { title: 'Renamed' });
    await nextTick();
    expect(b.sink.window).toEqual([{ rev: 1, windowId: b.id, title: 'Renamed' }]);
    expect(a.sink.pushWindow).not.toHaveBeenCalled();
    expect(a.sink.pushApp).not.toHaveBeenCalled();
  });

  it('coalesces changes within a tick into one push with the latest value', async () => {
    const { hub, a } = setup();
    hub.updateApp({ locale: 'de' });
    hub.updateApp({ locale: 'fr' });
    hub.updateWindow(a.id, { title: 'one' });
    hub.updateWindow(a.id, { title: 'two' });
    await nextTick();
    expect(a.sink.app).toEqual([expect.objectContaining({ rev: 2, locale: 'fr' })]);
    expect(a.sink.window).toEqual([expect.objectContaining({ rev: 2, title: 'two' })]);
  });

  it('stops pushing to a window once it is unregistered', async () => {
    const { hub, a, b } = setup();
    hub.updateWindow(a.id, { title: 'pending' });
    hub.unregisterWindow(a.id);
    hub.updateApp({ locale: 'de' });
    await nextTick();
    expect(a.sink.pushApp).not.toHaveBeenCalled();
    expect(a.sink.pushWindow).not.toHaveBeenCalled();
    expect(b.sink.pushApp).toHaveBeenCalledOnce();
    expect(hub.windowIds).toEqual([b.id]);
  });

  it('keeps pushing to other windows when one sink throws', async () => {
    const log = vi.fn();
    const hub = new StateHub({ locale: 'en', platform: 'linux', material: 'none' }, log);
    const broken: WindowSink = {
      pushApp: () => {
        throw new Error('webContents destroyed');
      },
      pushWindow: () => {},
    };
    const ok = fakeSink();
    hub.registerWindow(randomUUID(), { title: 'broken' }, broken);
    hub.registerWindow(randomUUID(), { title: 'ok' }, ok);
    hub.updateApp({ locale: 'de' });
    await nextTick();
    expect(ok.pushApp).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledOnce();
  });

  it('notifies change listeners after pushing', async () => {
    const { hub, a } = setup();
    const listener = vi.fn();
    hub.onChange(listener);
    hub.updateApp({ locale: 'de' });
    hub.updateWindow(a.id, { title: 'x' });
    await nextTick();
    expect(listener.mock.calls).toEqual([
      [{ store: 'app' }],
      [{ store: 'window', windowId: a.id }],
    ]);
  });

  it('rejects changes to unknown windows and invalid values with FiddleErrors', () => {
    const { hub } = setup();
    expect(() => hub.updateWindow(randomUUID(), { title: 'x' })).toThrow(
      expect.objectContaining({ code: ErrorCode.notFound }),
    );
    const invalid = () => hub.updateApp({ platform: 'beos' as never });
    expect(invalid).toThrow(FiddleError);
    expect(invalid).toThrow(expect.objectContaining({ code: ErrorCode.invalidArgument }));
    expect(hub.app.rev).toBe(0);
  });

  it('refuses to register the same window twice', () => {
    const { hub, a } = setup();
    expect(() => hub.registerWindow(a.id, { title: 'again' }, fakeSink())).toThrow(
      expect.objectContaining({ code: ErrorCode.conflict }),
    );
  });
});
