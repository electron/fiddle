/** The origin check every EIPC method and store read goes through (`validator MainFrame` in src/ipc/fiddle.eipc). */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const electron = vi.hoisted(() => ({ isPackaged: true }));

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return electron.isPackaged;
    },
  },
}));

import { implement, Window } from '../ipc/main';

type Handler = (event: unknown, ...args: unknown[]) => Promise<unknown>;

function bind() {
  const handlers = new Map<string, Handler>();
  const target = {
    ipc: {
      handle: (channel: string, handler: Handler) => handlers.set(channel, handler),
      removeHandler: vi.fn(),
      on: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    send: vi.fn(),
  };
  const impl = {
    ReportReady: vi.fn(),
    RunCommand: vi.fn(),
    getInitialWindowState: vi.fn(),
  };
  implement(Window, target as never, impl as never);
  const channel = [...handlers.keys()].find((name) =>
    name.endsWith('Window_$_ReportReady'),
  )!;
  return { call: (event: unknown) => handlers.get(channel)!(event), impl };
}

const frame = (url: string, parent: object | null = null) => ({
  senderFrame: { url, parent },
});

beforeEach(() => {
  electron.isPackaged = true;
});

describe('the main-frame origin check', () => {
  it('accepts the app origin in the main frame', async () => {
    const { call, impl } = bind();
    await call(frame('app://main/index.html'));
    await call(frame('app://main/'));
    expect(impl.ReportReady).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['a sub-frame of the app', frame('app://main/index.html', {})],
    ['another web origin', frame('https://evil.example/')],
    ['another app:// host', frame('app://other/index.html')],
    ['a host that only starts with main', frame('app://main.evil.example/')],
    ['a file page', frame('file:///etc/hosts')],
    ['a page with no sender frame', { senderFrame: null }],
    ['an event with no frame at all', {}],
    ['an empty URL', frame('')],
    ['a URL that does not parse', frame('not a url')],
  ])('rejects %s, without calling the handler', async (_name, event) => {
    const { call, impl } = bind();
    await expect(call(event)).rejects.toThrow();
    expect(impl.ReportReady).not.toHaveBeenCalled();
  });

  it('rejects the Vite dev server in a packaged app', async () => {
    const { call, impl } = bind();
    await expect(call(frame('http://localhost:5173/'))).rejects.toThrow();
    expect(impl.ReportReady).not.toHaveBeenCalled();
  });

  describe('in an unpackaged app', () => {
    beforeEach(() => {
      electron.isPackaged = false;
    });

    it('also accepts http://localhost, in the main frame only', async () => {
      const { call, impl } = bind();
      await call(frame('http://localhost:5173/'));
      expect(impl.ReportReady).toHaveBeenCalledOnce();
      await expect(call(frame('http://localhost:5173/', {}))).rejects.toThrow();
    });

    it.each([
      'http://localhost.evil.example/',
      'https://localhost/',
      'http://127.0.0.1:5173/',
      'ws://localhost/',
    ])('still rejects %s', async (url) => {
      const { call, impl } = bind();
      await expect(call(frame(url))).rejects.toThrow();
      expect(impl.ReportReady).not.toHaveBeenCalled();
    });
  });
});
