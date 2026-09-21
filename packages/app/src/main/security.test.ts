import { EventEmitter } from 'node:events';

import type { WebContents } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const confirm = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => false));
const openExternal = vi.hoisted(() =>
  vi.fn(async (..._args: unknown[]): Promise<void> => undefined),
);

vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events');
  return {
    app: new EventEmitter(),
    BrowserWindow: { fromWebContents: () => null },
    session: {},
    shell: { openExternal },
  };
});
vi.mock('./dialogs', () => ({ confirm }));
vi.mock('./i18n');
vi.mock('./log');

import { app } from 'electron';

import {
  applySessionSecurity,
  blockNavigation,
  hardenAllWebContents,
  openExternalLink,
} from './security';

const DEV_URL = 'http://localhost:5173/';

function navigate(
  loaded: string,
  url: string,
  name = 'will-navigate',
  isMainFrame = true,
) {
  const contents = Object.assign(new EventEmitter(), { getURL: () => loaded });
  blockNavigation(contents as unknown as WebContents);
  const event = { url, isMainFrame, preventDefault: vi.fn() };
  contents.emit(name, event);
  return event;
}

describe('blockNavigation', () => {
  beforeEach(() => confirm.mockClear());

  it('lets the page reload itself', () => {
    // Vite's full reload on `yarn start` with a cold dependency cache.
    expect(navigate(DEV_URL, DEV_URL).preventDefault).not.toHaveBeenCalled();
    expect(
      navigate('app://main/index.html', 'app://main/index.html').preventDefault,
    ).not.toHaveBeenCalled();
    expect(
      navigate(DEV_URL, DEV_URL, 'will-frame-navigate').preventDefault,
    ).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('blocks every other navigation and offers http(s) links to the browser', () => {
    expect(
      navigate(DEV_URL, 'https://example.com/').preventDefault,
    ).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledOnce();
    // Same origin, another page: still not a reload.
    expect(navigate(DEV_URL, `${DEV_URL}other`).preventDefault).toHaveBeenCalledOnce();
    expect(
      navigate(DEV_URL, DEV_URL, 'will-frame-navigate', false).preventDefault,
    ).toHaveBeenCalledOnce();
    expect(
      navigate(DEV_URL, DEV_URL, 'will-redirect').preventDefault,
    ).toHaveBeenCalledOnce();
  });

  it('never offers a non-http(s) URL to the browser', () => {
    expect(navigate(DEV_URL, 'file:///etc/passwd').preventDefault).toHaveBeenCalledOnce();
    expect(confirm).not.toHaveBeenCalled();
  });
});

describe('openExternalLink', () => {
  beforeEach(() => {
    confirm.mockClear();
    openExternal.mockClear();
  });

  it('opens an http(s) link only after the user answers "open"', async () => {
    confirm.mockResolvedValueOnce(true);
    await openExternalLink('https://example.com/docs?a=1');
    expect(confirm).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ detail: 'https://example.com/docs?a=1', ok: 'openLink' }),
    );
    expect(openExternal).toHaveBeenCalledExactlyOnceWith('https://example.com/docs?a=1');
  });

  it('does nothing when the user cancels', async () => {
    confirm.mockResolvedValueOnce(false);
    await openExternalLink('https://example.com/');
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('ignores other schemes and text that is not a URL, without asking', async () => {
    for (const url of [
      'javascript:alert(1)',
      'file:///etc/passwd',
      'app://main/index.html',
      'not a url',
      '',
    ]) {
      await openExternalLink(url);
    }
    expect(confirm).not.toHaveBeenCalled();
    expect(openExternal).not.toHaveBeenCalled();
  });
});

describe('hardenAllWebContents', () => {
  function created() {
    const contents = Object.assign(new EventEmitter(), {
      setWindowOpenHandler: vi.fn(),
      getURL: () => 'app://main/index.html',
    });
    (app as unknown as EventEmitter).emit('web-contents-created', {}, contents);
    return contents;
  }

  beforeEach(() => {
    (app as unknown as EventEmitter).removeAllListeners();
    hardenAllWebContents();
    confirm.mockClear();
    openExternal.mockClear();
  });

  it('denies every new window and offers its link to the browser', () => {
    const contents = created();
    const handler = contents.setWindowOpenHandler.mock.calls[0]![0] as (details: {
      url: string;
    }) => unknown;
    expect(handler({ url: 'https://example.com/' })).toEqual({ action: 'deny' });
    expect(confirm).toHaveBeenCalledOnce();
    expect(handler({ url: 'file:///etc/passwd' })).toEqual({ action: 'deny' });
    expect(confirm).toHaveBeenCalledOnce();
  });

  it('prevents webviews and denies bluetooth device selection', () => {
    const contents = created();
    const webview = { preventDefault: vi.fn() };
    contents.emit('will-attach-webview', webview);
    expect(webview.preventDefault).toHaveBeenCalledOnce();

    const callback = vi.fn();
    const select = { preventDefault: vi.fn() };
    contents.emit('select-bluetooth-device', select, [], callback);
    expect(select.preventDefault).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith('');
  });
});

describe('applySessionSecurity', () => {
  function stubSession() {
    const handlers: Record<string, (...args: never[]) => unknown> = {};
    const ses = Object.assign(new EventEmitter(), {
      setPermissionRequestHandler: (fn: (...args: never[]) => unknown) =>
        (handlers.request = fn),
      setPermissionCheckHandler: (fn: (...args: never[]) => unknown) =>
        (handlers.check = fn),
      setDevicePermissionHandler: (fn: (...args: never[]) => unknown) =>
        (handlers.device = fn),
      setDisplayMediaRequestHandler: (fn: (...args: never[]) => unknown) =>
        (handlers.media = fn),
      setSpellCheckerEnabled: vi.fn(),
      setBluetoothPairingHandler: (fn: (...args: never[]) => unknown) =>
        (handlers.pairing = fn),
    });
    applySessionSecurity(ses as never);
    return { ses, handlers };
  }

  it('denies every permission request and check', () => {
    const { handlers } = stubSession();
    for (const permission of [
      'clipboard-read',
      'media',
      'notifications',
      'geolocation',
    ]) {
      const callback = vi.fn();
      (handlers.request as (...args: unknown[]) => void)({}, permission, callback);
      expect(callback).toHaveBeenCalledExactlyOnceWith(false);
      expect(handlers.check!()).toBe(false);
    }
    expect(handlers.device!()).toBe(false);
  });

  it('answers device pickers and display capture with nothing', () => {
    const { ses, handlers } = stubSession();
    const media = vi.fn();
    (handlers.media as (...args: unknown[]) => void)({}, media);
    expect(media).toHaveBeenCalledWith({});

    for (const [event, args, empty] of [
      ['select-hid-device', [{}], undefined],
      ['select-usb-device', [{}], undefined],
      ['select-serial-port', [[], {}], ''],
    ] as const) {
      const callback = vi.fn();
      const domEvent = { preventDefault: vi.fn() };
      ses.emit(event, domEvent, ...args, callback);
      expect(domEvent.preventDefault).toHaveBeenCalledOnce();
      if (empty === undefined) expect(callback).toHaveBeenCalledWith();
      else expect(callback).toHaveBeenCalledWith(empty);
    }
  });
});
