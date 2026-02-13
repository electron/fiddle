import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { configure as mobxConfigure } from 'mobx';
import { afterEach, beforeEach, expect, vi } from 'vitest';

import { AppMock, ElectronFiddleMock, MonacoMock } from './mocks/mocks';

// allow vitest fns to overwrite readonly mobx stuff
// https://mobx.js.org/configuration.html#safedescriptors-boolean
mobxConfigure({ safeDescriptors: false });

global.confirm = vi.fn();

if (!process.env.FIDDLE_VERBOSE_TESTS) {
  vi.spyOn(global.console, 'error').mockImplementation(() => vi.fn());
  vi.spyOn(global.console, 'info').mockImplementation(() => vi.fn());
  vi.spyOn(global.console, 'log').mockImplementation(() => vi.fn());
  vi.spyOn(global.console, 'warn').mockImplementation(() => vi.fn());
  vi.spyOn(global.console, 'debug').mockImplementation(() => vi.fn());
}
vi.mock('electron', () => import('./mocks/electron.js'));
vi.mock('fs-extra');

// Disable Sentry in tests
vi.mock('@sentry/electron/main', () => ({
  init: vi.fn(),
}));
vi.mock('@sentry/electron/renderer', () => ({
  init: vi.fn(),
}));

class FakeBroadcastChannel extends EventTarget {
  public name: string;

  constructor(channelName: string) {
    super();
    this.name = channelName;
  }

  postMessage(message: unknown) {
    this.dispatchEvent(new MessageEvent('message', { data: message }));
  }
}

(global.BroadcastChannel as any) = class Singleton {
  static channels = new Map();

  constructor(channelName: string) {
    if (!Singleton.channels.has(channelName)) {
      Singleton.channels.set(
        channelName,
        new FakeBroadcastChannel(channelName),
      );
    }
    return Singleton.channels.get(channelName);
  }
};

// Don't serialize Timeout objects in depth
// TODO(dsanders11): This feels like we shouldn't need to do this?
expect.addSnapshotSerializer({
  serialize(val) {
    return val.toString();
  },
  test(val) {
    return val?.constructor.name === 'Timeout';
  },
});

// We want to detect vi sometimes
(global as any).__vi__ = (global as any).__vi__ || {};

// Setup for main tests
global.window = global.window || {};
global.document = global.document || { body: {} };
global.fetch = window.fetch = vi.fn();

delete (window as any).localStorage;
(window.localStorage as any) = {};

window.navigator = window.navigator ?? {};
(window.navigator.clipboard as any) = {};

/**
 * Mock these properties twice so that they're available
 * both at the top-level of files and also within the
 * code called in individual tests.
 */
(window.ElectronFiddle as any) = new ElectronFiddleMock();
(window.monaco as any) = new MonacoMock();
(window.app as any) = new AppMock();
window.localStorage.setItem = vi.fn();
window.localStorage.getItem = vi.fn();
window.localStorage.removeItem = vi.fn();
window.open = vi.fn();
window.navigator.clipboard.readText = vi.fn();
window.navigator.clipboard.writeText = vi.fn();

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.resetAllMocks();

  (process.env.TEST as any) = true;
  document.body.innerHTML = '<div id="app" />';

  (window.ElectronFiddle as any) = new ElectronFiddleMock();
  (window.monaco as any) = new MonacoMock();
  (window.app as any) = new AppMock();
  vi.mocked(window.localStorage.setItem).mockReset();
  vi.mocked(window.localStorage.getItem).mockReset();
  vi.mocked(window.localStorage.removeItem).mockReset();
  vi.mocked(window.open).mockReset();
  window.matchMedia = vi.fn((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});
