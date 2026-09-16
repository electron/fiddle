import { EventEmitter } from 'node:events';

import type { WebContents } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const messageBox = vi.hoisted(() => vi.fn(async () => ({ response: 1 })));

vi.mock('electron', () => ({
  app: {},
  BrowserWindow: { fromWebContents: () => null },
  session: {},
  shell: { openExternal: vi.fn() },
}));
vi.mock('./dialogs', () => ({ messageBox }));
vi.mock('./i18n', () => ({ t: (key: string) => key }));
vi.mock('./log', () => ({ log: { warn: vi.fn() } }));

import { blockNavigation } from './security';

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
  beforeEach(() => messageBox.mockClear());

  it('lets the page reload itself', () => {
    // Vite's full reload on `yarn start` with a cold dependency cache.
    expect(navigate(DEV_URL, DEV_URL).preventDefault).not.toHaveBeenCalled();
    expect(
      navigate('app://main/index.html', 'app://main/index.html').preventDefault,
    ).not.toHaveBeenCalled();
    expect(
      navigate(DEV_URL, DEV_URL, 'will-frame-navigate').preventDefault,
    ).not.toHaveBeenCalled();
    expect(messageBox).not.toHaveBeenCalled();
  });

  it('blocks every other navigation and offers http(s) links to the browser', () => {
    expect(
      navigate(DEV_URL, 'https://example.com/').preventDefault,
    ).toHaveBeenCalledOnce();
    expect(messageBox).toHaveBeenCalledOnce();
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
    expect(messageBox).not.toHaveBeenCalled();
  });
});
